import Anthropic from "@anthropic-ai/sdk";
import { svc } from "./ingest";
import { moveEmailToFolder } from "@/lib/unipile/client";
import { NOISE_LOCAL, NEWSLETTER_BODY } from "./upstream-filter";
import {
  TRIAGE_FOLDER_SLUGS, FOLDER_GRID, KNOWN_SAAS_SENDERS, FOLDER_IMAP_NAME,
  isValidFolder, type TriageFolderSlug,
} from "./triage-config";

// classifyMailbox (chantier C, V1) — sibling de classify.ts, pour les comptes en mode `classify`
// (boîte de Rafi). Il ÉTIQUETTE seulement un dossier thématique (les 10 du doc) + un flag "à traiter".
// JAMAIS de réponse, jamais d'a/b/c leads, AUCUN dispatch (retiré V1 — le "à qui" reste à cadrer avec
// Rafi). Le résultat sert au rangement IMAP direct DANS la boîte de Rafi (autoFileMail), pas à une page
// CRM. Une seule passe LLM, précédée d'un filtre amont déterministe (newsletter / SaaS connu / client
// existant) pour ne pas payer un appel sur du bruit évident. Motifs de bruit partagés avec upstream-filter.ts.
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface MailboxTriageResult {
  folder: TriageFolderSlug;
  action_required: boolean;
}

const TOOL: Anthropic.Tool = {
  name: "triage_mailbox",
  description: "Classe un email de la boîte de Rafi dans un dossier thématique.",
  input_schema: {
    type: "object",
    properties: {
      folder: { type: "string", enum: [...TRIAGE_FOLDER_SLUGS] },
      action_required: { type: "boolean", description: "true si le mail attend une action concrète (réponse, traitement, décision) ; false pour une simple information/newsletter/notification" },
    },
    required: ["folder", "action_required"],
  },
};

const RULES = `${FOLDER_GRID}

action_required = true si le mail attend une action concrète (réponse, traitement, décision), false pour une information, une newsletter ou une notification.`;

export async function classifyMailbox(conversationId: string): Promise<MailboxTriageResult | null> {
  const sb = svc();
  const { data: conv } = await sb.from("conversations").select("channel, subject, contact_id").eq("id", conversationId).maybeSingle();
  const { data: msgs } = await sb.from("messages").select("body, direction, sender_handle")
    .eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(5);
  if (!conv || !msgs?.length) return null;

  const inbound = msgs.find((m) => m.direction === "inbound") ?? msgs[0];
  const senderHandle = (inbound?.sender_handle ?? "").trim().toLowerCase();
  const subject = conv.subject ?? "";
  const body = inbound?.body ?? msgs[0].body ?? "";
  const contactId = (conv.contact_id as string | null) ?? null;

  // 1) Filtre amont déterministe (sans LLM).
  const fast = await resolveDeterministic(sb, senderHandle, subject, body, contactId);
  if (fast) return persistFolder(sb, conversationId, fast);

  // 2) Passe LLM : dossier + action_required.
  const transcript = msgs.slice().reverse().map((m) => `[${m.direction}] ${m.body}`).join("\n");
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 120,
    tool_choice: { type: "tool", name: "triage_mailbox" },
    tools: [TOOL],
    messages: [{ role: "user", content: `Canal: ${conv.channel}\nExpéditeur: ${senderHandle || "—"}\nSujet: ${subject || "—"}\nMessages:\n${transcript}\n\n${RULES}` }],
  });
  const block = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!block) return null;
  const out = block.input as { folder?: string; action_required?: boolean };
  if (!isValidFolder(out.folder)) return null;

  const result: MailboxTriageResult = { folder: out.folder, action_required: Boolean(out.action_required) };
  return persistFolder(sb, conversationId, result);
}

async function resolveDeterministic(
  sb: ReturnType<typeof svc>, senderHandle: string, subject: string, body: string, contactId: string | null
): Promise<MailboxTriageResult | null> {
  if (senderHandle.includes("@")) {
    const local = senderHandle.split("@")[0];
    if (NOISE_LOCAL.test(local) || NEWSLETTER_BODY.test(`${subject}\n${body}`)) {
      return { folder: "veille_newsletters", action_required: false };
    }
    const domain = senderHandle.split("@")[1] ?? "";
    if (KNOWN_SAAS_SENDERS.some((s) => senderHandle.includes(s) || domain.includes(s))) {
      return { folder: "outils_abonnements", action_required: false };
    }
  }
  // Client existant (contact avec ≥1 deal) → 01 clients. Le sous-cas fin n'est pas tranché en V1.
  if (contactId) {
    const { count } = await sb.from("deals").select("id", { count: "exact", head: true }).eq("contact_id", contactId);
    if ((count ?? 0) > 0) {
      return { folder: "clients", action_required: false };
    }
  }
  return null;
}

// Persiste le dossier (lu par autoFileMail pour le rangement IMAP). Verrou human : l'IA ne réécrit jamais
// un dossier posé à la main (`.neq('human')` sûr car triage_folder_source est NOT NULL DEFAULT 'ai').
// PAS de triage_folder_reason (minimisation RGPD : non lu côté CRM, on évite de stocker du contenu sensible).
async function persistFolder(
  sb: ReturnType<typeof svc>, conversationId: string, result: MailboxTriageResult
): Promise<MailboxTriageResult> {
  const { error } = await sb.from("conversations").update({
    triage_folder: result.folder,
    triage_action_required: result.action_required,
    triage_folder_source: "ai",
  }).eq("id", conversationId).neq("triage_folder_source", "human");
  if (error) {
    // Colonnes non migrées (42703) → on log et on s'arrête sans crasher le webhook (zéro régression).
    console.warn("[inbox.classify-mailbox] triage columns not persisted (migration applied?):", error.message);
  }
  return result;
}

// Auto-classement IMAP — gated DEUX FOIS : (1) au call site, seulement si account.autoFile=true (flippé
// au cutover, une fois l'arbo de Rafi créée — sinon Unipile créerait des dossiers en double) ; (2) dans
// moveEmailToFolder, no-op si Unipile non configuré. Déplace le DERNIER message inbound dans le dossier
// IMAP correspondant au triage_folder PERSISTÉ (respecte donc un re-classement humain). Email uniquement
// (IMAP folders ≠ chat). Best-effort : le call site catch toute erreur.
export async function autoFileMail(conversationId: string): Promise<void> {
  const sb = svc();
  const { data: conv } = await sb.from("conversations")
    .select("account_id, channel, triage_folder").eq("id", conversationId).maybeSingle();
  if (!conv || conv.channel !== "email" || !conv.account_id || !conv.triage_folder) return;
  const folderName = FOLDER_IMAP_NAME[conv.triage_folder as TriageFolderSlug];
  if (!folderName) return;
  const { data: msg } = await sb.from("messages").select("external_message_id")
    .eq("conversation_id", conversationId).eq("direction", "inbound")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!msg?.external_message_id) return;
  await moveEmailToFolder(conv.account_id as string, msg.external_message_id as string, folderName);
}
