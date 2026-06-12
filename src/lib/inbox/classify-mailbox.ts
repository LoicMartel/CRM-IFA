import Anthropic from "@anthropic-ai/sdk";
import { svc } from "./ingest";
import { createNotification } from "@/lib/notifications";
import { moveEmailToFolder } from "@/lib/unipile/client";
import { NOISE_LOCAL, NEWSLETTER_BODY } from "./upstream-filter";
import {
  TRIAGE_FOLDER_SLUGS, ASSIGNEES, ASSIGNEE_EMAILS, FOLDER_GRID, SPLIT_RULES, KNOWN_SAAS_SENDERS,
  FOLDER_IMAP_NAME, deterministicAssignee, isValidFolder, isValidAssignee, folderMeta,
  type TriageFolderSlug, type AssigneeSlug,
} from "./triage-config";

// classifyMailbox (chantier C) — sibling de classify.ts, mais pour les comptes en mode `classify`
// (boîte de Rafi). Il ÉTIQUETTE seulement : un dossier thématique (les 10 du doc), un flag "à traiter"
// et un destinataire (dispatch). JAMAIS de réponse, jamais d'a/b/c leads. Une seule passe LLM, précédée
// d'un filtre amont déterministe (newsletter / SaaS connu / client existant) pour ne pas payer un appel
// sur du bruit évident. Les motifs de bruit sont partagés avec upstream-filter.ts (source unique).
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface MailboxTriageResult {
  folder: TriageFolderSlug;
  action_required: boolean;
  assignee: AssigneeSlug | null;
  reason: string;
}

const TOOL: Anthropic.Tool = {
  name: "triage_mailbox",
  description: "Classe un email de la boîte de Rafi dans un dossier thématique et indique qui doit le traiter.",
  input_schema: {
    type: "object",
    properties: {
      folder: { type: "string", enum: [...TRIAGE_FOLDER_SLUGS] },
      action_required: { type: "boolean", description: "true si le mail attend une action concrète de l'équipe ; false pour une simple information/notification" },
      assignee: { type: "string", enum: [...ASSIGNEES], description: "qui doit traiter — UNIQUEMENT pour les dossiers à sous-règle (clients, commercial, reseau_institutionnel) ; sinon ne pas l'émettre" },
      reason: { type: "string", description: "UNE phrase courte et ABSTRAITE (aucun détail personnel/sensible) justifiant le dossier" },
    },
    required: ["folder", "action_required", "reason"],
  },
};

const RULES = `${FOLDER_GRID}

Pour les dossiers à sous-règle, choisis aussi "assignee" :
- ${SPLIT_RULES.clients}
- ${SPLIT_RULES.commercial}
- ${SPLIT_RULES.reseau_institutionnel}
Pour les autres dossiers, n'émets PAS d'assignee (il est déterminé automatiquement).

action_required = true si le mail attend une action concrète (réponse, traitement, décision), false pour une information, une newsletter ou une notification.
reason = UNE phrase courte et ABSTRAITE (ne recopie aucun détail personnel/sensible).`;

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
  if (fast) return persistAndDispatch(sb, conversationId, fast, contactId);

  // 2) Passe LLM : dossier + action_required + (sous-cas) assignee + reason.
  const transcript = msgs.slice().reverse().map((m) => `[${m.direction}] ${m.body}`).join("\n");
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 320,
    tool_choice: { type: "tool", name: "triage_mailbox" },
    tools: [TOOL],
    messages: [{ role: "user", content: `Canal: ${conv.channel}\nExpéditeur: ${senderHandle || "—"}\nSujet: ${subject || "—"}\nMessages:\n${transcript}\n\n${RULES}` }],
  });
  const block = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!block) return null;
  const out = block.input as { folder?: string; action_required?: boolean; assignee?: string | null; reason?: string };
  if (!isValidFolder(out.folder)) return null;
  const folder = out.folder;

  // Destinataire : dossiers à split → choix LLM validé ; dossiers 1:1 → déterministe.
  let assignee = deterministicAssignee(folder);
  if (folderMeta(folder).llmSplit) {
    assignee = isValidAssignee(out.assignee) ? out.assignee : (folderMeta(folder).defaultAssignee ?? null);
  }

  const result: MailboxTriageResult = {
    folder,
    action_required: Boolean(out.action_required),
    assignee,
    reason: (out.reason ?? "").slice(0, 140), // minimisation RGPD : court / abstrait
  };
  return persistAndDispatch(sb, conversationId, result, contactId);
}

async function resolveDeterministic(
  sb: ReturnType<typeof svc>, senderHandle: string, subject: string, body: string, contactId: string | null
): Promise<MailboxTriageResult | null> {
  if (senderHandle.includes("@")) {
    const local = senderHandle.split("@")[0];
    if (NOISE_LOCAL.test(local) || NEWSLETTER_BODY.test(`${subject}\n${body}`)) {
      return { folder: "veille_newsletters", action_required: false, assignee: null, reason: "Expéditeur automatisé / newsletter (filtre amont)." };
    }
    const domain = senderHandle.split("@")[1] ?? "";
    if (KNOWN_SAAS_SENDERS.some((s) => senderHandle.includes(s) || domain.includes(s))) {
      return { folder: "outils_abonnements", action_required: false, assignee: deterministicAssignee("outils_abonnements"), reason: "Notification d'un outil/SaaS connu (filtre amont)." };
    }
  }
  // Client existant (contact avec ≥1 deal) → 01 clients, défaut Rafi (relation). Le sous-cas fin
  // (pédago/facture) n'est tranché que lorsque le LLM tourne ; ici on reste sur le défaut sûr.
  if (contactId) {
    const { count } = await sb.from("deals").select("id", { count: "exact", head: true }).eq("contact_id", contactId);
    if ((count ?? 0) > 0) {
      return { folder: "clients", action_required: false, assignee: "rafi", reason: "Contact client existant (match annuaire)." };
    }
  }
  return null;
}

async function persistAndDispatch(
  sb: ReturnType<typeof svc>, conversationId: string, result: MailboxTriageResult, contactId: string | null
): Promise<MailboxTriageResult> {
  // Verrou human PAR AXE — l'IA ne réécrit jamais un champ posé à la main. `.neq('human')` est sûr car
  // les colonnes *_source sont NOT NULL DEFAULT 'ai' (jamais NULL). `.select()` dit si la ligne a bougé.
  // (1) Dossier (+ flag + reason) : seulement si le dossier n'est pas verrouillé humain.
  const { data: folderUpd, error } = await sb.from("conversations").update({
    triage_folder: result.folder,
    triage_action_required: result.action_required,
    triage_folder_reason: result.reason,
    triage_folder_source: "ai",
  }).eq("id", conversationId).neq("triage_folder_source", "human").select("id");

  if (error) {
    // Colonnes non migrées (42703) → on log et on s'arrête sans crasher le webhook (zéro régression).
    console.warn("[inbox.classify-mailbox] triage columns not persisted (migration applied?):", error.message);
    return result;
  }
  if (!folderUpd || folderUpd.length === 0) {
    // Dossier verrouillé humain → c'est l'humain qui possède la classification : on ne touche NI le
    // dossier, NI le destinataire (un assignee dérivé d'un dossier IA serait incohérent), pas de dispatch.
    return result;
  }

  // (2) Destinataire : seulement si pas verrouillé humain. Dispatch UNIQUEMENT s'il a vraiment été
  // (ré)écrit → évite de re-notifier à chaque inbound sur un assignee figé à la main.
  const { data: assigneeUpd } = await sb.from("conversations").update({
    triage_assignee: result.assignee,
    triage_assignee_source: "ai",
  }).eq("id", conversationId).neq("triage_assignee_source", "human").select("id");

  if (assigneeUpd && assigneeUpd.length > 0) {
    await dispatchNotify(sb, conversationId, result, contactId);
  }
  return result;
}

// P2 — auto-classement IMAP. Gated DEUX FOIS : (1) au call site, seulement si account.autoFile=true ;
// (2) dans moveEmailToFolder, no-op si Unipile non configuré. Déplace le DERNIER message inbound dans
// le dossier IMAP correspondant au triage_folder PERSISTÉ (respecte donc un re-classement humain).
// Email uniquement (IMAP folders ≠ chat). Best-effort : le call site catch toute erreur.
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

// Dispatch P1 = NOTIFICATION uniquement (zéro écriture sur la boîte). On notifie le destinataire
// seulement quand il n'est ni Rafi ni null (sinon le mail reste chez Rafi, pas de dispatch).
async function dispatchNotify(sb: ReturnType<typeof svc>, conversationId: string, result: MailboxTriageResult, contactId: string | null): Promise<void> {
  const assignee = result.assignee;
  if (!assignee || assignee === "rafi") return;
  const email = ASSIGNEE_EMAILS[assignee];
  if (!email) return;
  const { data: member } = await sb.from("team_members").select("id").ilike("email", email).maybeSingle();
  if (!member?.id) {
    console.warn(`[inbox.classify-mailbox] dispatch skipped: no team_member for ${assignee} (${email}) — PENDING_VALIDATION.`);
    return;
  }
  let who = "un contact";
  if (contactId) {
    const { data: c } = await sb.from("contacts").select("first_name, last_name").eq("id", contactId).maybeSingle();
    who = `${c?.first_name ?? ""} ${c?.last_name ?? ""}`.trim() || who;
  }
  await createNotification({
    recipientId: member.id,
    type: "new_lead", // réutilise un type existant (le CHECK distant sur notifications.type est inconnu)
    title: `📮 Courrier à traiter — ${who}`,
    body: `${folderMeta(result.folder).label}${result.action_required ? " · à traiter" : ""}`,
    linkUrl: "/tri-courrier",
    relatedEntityType: "conversation",
    relatedEntityId: conversationId,
  });
}
