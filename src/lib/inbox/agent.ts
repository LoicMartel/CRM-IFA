import Anthropic from "@anthropic-ai/sdk";
import { svc } from "./ingest";
import { escalateConversation } from "./escalation";
import { resolveBookingLink } from "./booking-links";
import { sendChatMessage, sendEmail, unipileConfigured, type UnipileSendResult } from "@/lib/unipile/client";
import { resolveEmailReply } from "./threading";
import { type Channel } from "./types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `Tu es l'assistant commercial de La Closing Académie. Tu converses avec un NOUVEAU lead entrant.
Objectif: comprendre brièvement son besoin (1-2 questions max) puis l'amener à réserver un rendez-vous via le lien de réservation.
Style: français, court, professionnel et chaleureux. Pas de promesse d'horaire ferme (le lien gère les créneaux).
Règles d'escalade — utilise l'outil "escalate" si: le lead a un signal d'achat fort / forte valeur (reason "high_value"),
demande explicitement un humain ("explicit_human"), exprime mécontentement/refus ("negative"), pose une question hors de ton périmètre ("off_script"),
ou si tu n'es pas sûr de ta réponse ("low_confidence"). Sinon "reply" pour avancer, "send_booking_link" quand le lead est prêt à prendre RDV.`;

const TOOLS: Anthropic.Tool[] = [
  { name: "reply", description: "Répondre au lead pour avancer la conversation.",
    input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } },
  { name: "send_booking_link", description: "Le lead est prêt: envoyer un message avec le lien de réservation.",
    input_schema: { type: "object", properties: { intro: { type: "string", description: "phrase d'intro avant le lien" } }, required: ["intro"] } },
  { name: "escalate", description: "Passer la main à un humain.",
    input_schema: { type: "object", properties: {
      reason: { type: "string", enum: ["high_value", "explicit_human", "low_confidence", "off_script", "negative"] },
      summary: { type: "string", description: "résumé court pour Rafi" },
    }, required: ["reason", "summary"] } },
];

const EMAIL_SUBJECT = "Votre demande — La Closing Académie";

interface DeliverOpts {
  toName?: string | null;
  subject?: string;
  replyTo?: string | null;
}

// email + web_form (leads "fiche" sans chat d'origine) partent en EMAIL via Unipile.
// Quand la conversation n'a pas de compte d'origine (web_form), on retombe sur le
// compte email généraliste (UNIPILE_DEFAULT_EMAIL_ACCOUNT_ID, posé au cutover token).
async function deliver(channel: Channel, accountId: string | null, chatId: string | null, to: string | null, text: string, opts: DeliverOpts = {}): Promise<UnipileSendResult> {
  if (channel === "email" || channel === "web_form") {
    if (!to) throw new Error("no recipient email");
    const account = accountId ?? process.env.UNIPILE_DEFAULT_EMAIL_ACCOUNT_ID ?? null;
    if (!account) throw new Error("no email account (set UNIPILE_DEFAULT_EMAIL_ACCOUNT_ID)");
    return sendEmail({ accountId: account, to, toName: opts.toName ?? null, subject: opts.subject ?? EMAIL_SUBJECT, body: text, replyTo: opts.replyTo ?? null });
  }
  if (!chatId) throw new Error("no chat id");
  return sendChatMessage(chatId, text);
}

/** Message d'accueil fixe signé Rafi (lead "fiche"). Speed-to-lead: contact immédiat + lien RDV, sans latence IA. */
function buildGreeting(firstName: string): string {
  const hello = firstName ? `Bonjour ${firstName},` : "Bonjour,";
  return [
    hello,
    "",
    "Enchanté !",
    "Je viens de prendre connaissance de votre demande de renseignements.",
    "Comment puis-je vous aider ?",
    "",
    "Rafi, Expert La Closing Académie",
    `Mon agenda : ${resolveBookingLink()}`,
  ].join("\n");
}

/**
 * 1er contact d'un lead "fiche" (formulaire/agence). Envoie un message d'accueil
 * déterministe signé Rafi AVANT tout tour d'agent dynamique. L'agent (runAgentTurn)
 * prend le relais quand le lead répond. Même verrou anti-race que runAgentTurn.
 */
export async function sendGreeting(conversationId: string): Promise<void> {
  const sb = svc();
  const { data: conv } = await sb.from("conversations")
    .select("channel, account_id, external_chat_id, agent_status, contacts(first_name, email)")
    .eq("id", conversationId).maybeSingle();
  if (!conv || conv.agent_status !== "active") return;

  const contact = Array.isArray(conv.contacts) ? conv.contacts[0] : conv.contacts;
  const firstName = ((contact as { first_name: string | null } | null)?.first_name ?? "").trim();
  const to = (contact as { email: string | null } | null)?.email ?? null;
  const text = buildGreeting(firstName);

  // Verrou anti-double-envoi : on n'envoie que si la conversation est TOUJOURS active
  // (une prise de main humaine / un outbound anti-collision a pu la flipper entre-temps).
  const { data: lock } = await sb.from("conversations")
    .update({ agent_last_acted_at: new Date().toISOString() })
    .eq("id", conversationId).eq("agent_status", "active").select("id").maybeSingle();
  if (!lock) return;

  if (!unipileConfigured()) {
    console.warn("[inbox.agent] Unipile not configured — greeting skipped (would have sent).");
    return;
  }

  try {
    const ext = await deliver(conv.channel as Channel, conv.account_id, conv.external_chat_id, to, text);
    await sb.from("messages").insert({
      conversation_id: conversationId, direction: "outbound", sent_by: "agent", body: text,
      external_message_id: ext.id, status: "sent", sent_at: new Date().toISOString(),
    });
    await sb.from("conversations").update({ agent_turn_count: 1 }).eq("id", conversationId);
  } catch (e) {
    console.error("[inbox.agent] greeting send failed:", e);
    await escalateConversation(conversationId, "low_confidence", "Échec d'envoi du message d'accueil.");
  }
}

/** Un tour d'agent. isFollowup=true => relance (pas de nouveau message inbound). */
export async function runAgentTurn(conversationId: string, isFollowup = false): Promise<void> {
  const sb = svc();
  const { data: conv } = await sb.from("conversations")
    .select("channel, account_id, external_chat_id, intent, agent_status, agent_turn_count, contacts(email)")
    .eq("id", conversationId).maybeSingle();
  if (!conv || conv.agent_status !== "active") return;

  const { data: msgs } = await sb.from("messages").select("body, direction, sent_by").eq("conversation_id", conversationId)
    .order("created_at", { ascending: false }).limit(8);
  const transcript = (msgs ?? []).reverse().map((m) => `[${m.sent_by}] ${m.body}`).join("\n");
  const prompt = isFollowup
    ? `Échange jusqu'ici:\n${transcript}\n\nLe lead n'a pas répondu. Rédige UNE relance courte et non insistante (outil reply) ou propose le lien si pertinent.`
    : `Canal: ${conv.channel}\nIntent: ${conv.intent ?? "autre"}\nÉchange:\n${transcript}\n\nChoisis l'action.`;

  let decision;
  try {
    decision = await anthropic.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 600, system: SYSTEM, tools: TOOLS,
      tool_choice: { type: "any" }, messages: [{ role: "user", content: prompt }],
    });
  } catch (e) {
    console.error("[inbox.agent] anthropic error:", e);
    await escalateConversation(conversationId, "low_confidence", "Erreur technique de l'agent IA.");
    return;
  }

  const tool = decision.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!tool) { await escalateConversation(conversationId, "low_confidence", "L'agent n'a pas su décider."); return; }

  if (tool.name === "escalate") {
    const { reason, summary } = tool.input as { reason: "high_value" | "explicit_human" | "low_confidence" | "off_script" | "negative"; summary: string };
    await escalateConversation(conversationId, reason, summary);
    return;
  }

  let text: string;
  if (tool.name === "send_booking_link") {
    const { intro } = tool.input as { intro: string };
    text = `${intro}\n\nRéservez votre créneau ici : ${resolveBookingLink()}`;
  } else {
    text = (tool.input as { text: string }).text;
  }

  // Anti-race lock: only send if the conversation is STILL active after the (multi-second) LLM call.
  // A human takeover or an anti-collision outbound during the call flips the status; this conditional
  // update both detects that and stamps the action time atomically — closes the double-send window.
  const { data: lock } = await sb.from("conversations")
    .update({ agent_last_acted_at: new Date().toISOString() })
    .eq("id", conversationId).eq("agent_status", "active").select("id").maybeSingle();
  if (!lock) return; // taken over / paused / booked while we were thinking — do not send.

  // web_form/email are delivered via Unipile, falling back to the default account
  // (UNIPILE_DEFAULT_EMAIL_ACCOUNT_ID) in deliver(). Without Unipile configured we skip the
  // turn entirely rather than emit a phantom "sent" message.
  if (!unipileConfigured()) {
    console.warn("[inbox.agent] Unipile not configured — turn skipped (would have sent).");
    return;
  }

  try {
    const contact = Array.isArray(conv.contacts) ? conv.contacts[0] : conv.contacts;
    const to = (contact as { email: string | null } | null)?.email ?? null;
    let opts: DeliverOpts = {};
    if (conv.channel === "email" || conv.channel === "web_form") {
      const thread = await resolveEmailReply(sb, conversationId);
      // Only thread (Re: subject + reply_to) when replying to a real prior email; a fresh
      // web_form lead has no Unipile parent → keep the generic subject, no reply_to.
      opts = thread.replyTo
        ? { subject: thread.subject ?? EMAIL_SUBJECT, replyTo: thread.replyTo }
        : { subject: EMAIL_SUBJECT };
    }
    const ext = await deliver(conv.channel as Channel, conv.account_id, conv.external_chat_id, to, text, opts);
    await sb.from("messages").insert({
      conversation_id: conversationId, direction: "outbound", sent_by: "agent", body: text,
      external_message_id: ext.id, status: "sent", sent_at: new Date().toISOString(),
    });
    await sb.from("conversations").update({
      agent_turn_count: (conv.agent_turn_count ?? 0) + 1,
    }).eq("id", conversationId);
  } catch (e) {
    console.error("[inbox.agent] send failed:", e);
    await escalateConversation(conversationId, "low_confidence", "Échec d'envoi de la réponse de l'agent.");
  }
}
