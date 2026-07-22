import Anthropic from "@anthropic-ai/sdk";
import { svc } from "./ingest";
import { escalateConversation } from "./escalation";
import { sendChatMessage, sendEmail, unipileConfigured, type UnipileSendResult } from "@/lib/unipile/client";
import { resolveEmailReply } from "./threading";
import { MAX_AGENT_TURNS, type Channel } from "./types";
import { resolvePersona, type InboxPersona } from "./routing";
import { logMessageActivity } from "./activity";
import { LCA_CONTEXT } from "./lca-context";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// V3 (22/07, décisions Rafi) : le RDV est la sortie par défaut — y compris signal d'achat fort et
// demande d'humain (le RDV EST la mise en relation). L'escalade est réservée aux vrais incidents.
// Le détail des règles (identité Adam, 3 filtres, cas d'escalade) vit dans LCA_CONTEXT.
const SYSTEM_BASE = `Tu es « Adam », l'assistant IA de Rafi à La Closing Académie. Tu converses avec un NOUVEAU lead entrant et tu te présentes toujours comme un assistant IA.
Objectif: comprendre brièvement son besoin (1-2 questions max) puis l'amener à réserver un rendez-vous de 15 minutes avec un de nos experts via le lien de réservation.
Style: français, court, professionnel et chaleureux (un emoji léger est bienvenu). Pas de promesse d'horaire ferme (le lien gère les créneaux).
Le rendez-vous est TOUJOURS ta sortie préférée: signal d'achat fort, gros compte, sujet complexe (appel d'offres, financement) ou demande de parler à un humain → "send_booking_link" avec le cadrage « rendez-vous de 15 minutes avec un de nos experts ».
Utilise "escalate" UNIQUEMENT pour les vrais incidents: mécontentement/refus/ton négatif ("negative"), profil clairement hors cible ("off_script"),
réponse incomprehensible ou doute réel sur ton prochain message ("low_confidence"). Sinon "reply" pour avancer.
Applique strictement les règles du bloc CONTEXTE ci-dessous (identité, 3 filtres de qualification, prix, escalade).`;

// DM channels get a dedicated conversational contract (22/07, validated Teina/Rafi direction):
// short messages, ONE question per turn, and the booking link is EARNED by qualification —
// never dumped in the first message like the email flow does. Email keeps the original style.
const CHAT_CHANNELS: Channel[] = ["instagram", "whatsapp", "messenger"];

const DM_STYLE = `STYLE DM (canal chat — Instagram/WhatsApp/Messenger) — remplace le style email:
- Messages COURTS (1-3 phrases max), ton naturel de messagerie, tutoiement interdit — reste au vouvoiement chaleureux. Un emoji léger maximum par message.
- SÉQUENCE DE QUALIFICATION : pose UNE seule question par message, jamais deux. Déroule les 3 filtres naturellement (activité/rôle d'abord — la réponse couvre souvent plusieurs filtres d'un coup).
- Ne propose PAS le lien de rendez-vous dans ton premier message. Tu ne l'envoies (send_booking_link) QUE lorsqu'au moins un des 3 filtres est clairement vert.
- Si le lead demande d'emblée un rendez-vous ou les prix, applique les règles du bloc CONTEXTE (prix → message type + RDV).
- Pas de signature formelle en fin de message (c'est un chat, pas un email).`;

const INSTAGRAM_IDENTITY = `IDENTITÉ SUR CE CANAL (compte Instagram de la marque) : présente-toi comme « Adam, l'assistant IA de La Closing Académie » (pas « de Rafi » — tu parles au nom de la marque).`;

// System prompt = base rules + LCA grounding context (positioning + offer catalogue, so the
// agent stops hallucinating a generic B2C pitch) + channel style + optional voice profile.
function buildSystemPrompt(persona: InboxPersona, channel: Channel): string {
  let base = `${SYSTEM_BASE}\n\n${LCA_CONTEXT}`;
  if (CHAT_CHANNELS.includes(channel)) base += `\n\n${DM_STYLE}`;
  if (channel === "instagram") base += `\n\n${INSTAGRAM_IDENTITY}`;
  return persona.voiceProfile
    ? `${base}\n\nVOICE PROFILE — rédige en respectant ce style:\n${persona.voiceProfile}`
    : base;
}

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

/**
 * Message d'accueil fixe (lead "fiche"). Speed-to-lead: contact immédiat + lien RDV, sans latence IA.
 * Persona-driven (signature + booking link résolus par owner/compte). Aligné sur le modèle de
 * greeting de référence fourni par l'équipe (09/06). Défaut LCA = "Rafi, Expert La Closing Académie".
 */
function buildGreeting(firstName: string, persona: InboxPersona): string {
  const hello = firstName ? `Bonjour ${firstName},` : "Bonjour,";
  return [
    hello,
    "",
    "Enchanté, je suis Adam, l'assistant IA de Rafi à La Closing Académie 😊",
    "Je viens de prendre connaissance de votre demande de renseignements.",
    "Comment puis-je vous aider ?",
    "",
    persona.signature,
    `Mon agenda : ${persona.bookingLink}`,
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
  const persona = await resolvePersona(conv.account_id);
  const text = buildGreeting(firstName, persona);

  // Verrou CAS anti-double-envoi : le greeting est le 1er acte de l'agent → agent_last_acted_at est
  // TOUJOURS null à ce stade. On ne "gagne" le tour que si c'est encore le cas (aucun autre greeting
  // concurrent n'a agi). Le simple filtre agent_status='active' laissait passer deux greetings
  // concurrents (le statut ne change pas entre leurs lectures).
  const { data: lock } = await sb.from("conversations")
    .update({ agent_last_acted_at: new Date().toISOString() })
    .eq("id", conversationId).eq("agent_status", "active").is("agent_last_acted_at", null)
    .select("id").maybeSingle();
  if (!lock) return;

  if (!unipileConfigured()) {
    // Fail loud, pas de skip silencieux : le lead n'est pas contacté → un humain doit le rappeler,
    // et l'escalade sort la conversation de 'active' (le cron ne relance plus dans le vide).
    console.warn("[inbox.agent] Unipile not configured — greeting not sent, escalating.");
    await escalateConversation(conversationId, "low_confidence", "Unipile non configuré — message d'accueil non envoyé, lead à contacter manuellement.");
    return;
  }

  try {
    const ext = await deliver(conv.channel as Channel, conv.account_id, conv.external_chat_id, to, text);
    await sb.from("messages").insert({
      conversation_id: conversationId, direction: "outbound", sent_by: "agent", body: text,
      external_message_id: ext.id, status: "sent", sent_at: new Date().toISOString(),
    });
    await sb.from("conversations").update({ agent_turn_count: 1 }).eq("id", conversationId);
    await logMessageActivity(sb, conversationId, { direction: "outbound", channel: conv.channel as Channel, sentBy: "agent", body: text });
  } catch (e) {
    console.error("[inbox.agent] greeting send failed:", e);
    await escalateConversation(conversationId, "low_confidence", "Échec d'envoi du message d'accueil.");
  }
}

/** Un tour d'agent. isFollowup=true => relance (pas de nouveau message inbound). */
export async function runAgentTurn(conversationId: string, isFollowup = false): Promise<void> {
  const sb = svc();
  const { data: conv } = await sb.from("conversations")
    .select("channel, account_id, external_chat_id, intent, agent_status, agent_turn_count, agent_last_acted_at, contacts(email)")
    .eq("id", conversationId).maybeSingle();
  if (!conv || conv.agent_status !== "active") return;

  // Cap dur "3 échanges max" (design déterministe 03/07) — enforced en code, pas seulement dans le
  // prompt. Un lead encore non qualifié au cap passe à un humain avec notification (escalade),
  // jamais en tour supplémentaire ni en dormant silencieux.
  if ((conv.agent_turn_count ?? 0) >= MAX_AGENT_TURNS) {
    await escalateConversation(conversationId, "low_confidence",
      `${MAX_AGENT_TURNS} échanges agent atteints sans qualification — reprise humaine requise.`);
    return;
  }

  // Sans Unipile configuré l'agent ne peut pas envoyer : escalade AVANT l'appel LLM (pas de skip
  // silencieux qui laisse la conversation active et fait payer un appel IA à chaque relance cron).
  if (!unipileConfigured()) {
    await escalateConversation(conversationId, "low_confidence", "Unipile non configuré — l'agent ne peut pas répondre, lead à traiter manuellement.");
    return;
  }

  const { data: msgs } = await sb.from("messages").select("body, direction, sent_by").eq("conversation_id", conversationId)
    .order("created_at", { ascending: false }).limit(8);
  const transcript = (msgs ?? []).reverse().map((m) => `[${m.sent_by}] ${m.body}`).join("\n");
  const prompt = isFollowup
    ? `Échange jusqu'ici:\n${transcript}\n\nLe lead n'a pas répondu. Rédige UNE relance courte et non insistante (outil reply) ou propose le lien si pertinent.`
    : `Canal: ${conv.channel}\nIntent: ${conv.intent ?? "autre"}\nÉchange:\n${transcript}\n\nChoisis l'action.`;

  const persona = await resolvePersona(conv.account_id);

  let decision;
  try {
    decision = await anthropic.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 600, temperature: 0, // agent déterministe (design 03/07)
      system: buildSystemPrompt(persona, conv.channel as Channel), tools: TOOLS,
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
    text = `${intro}\n\nRéservez votre créneau ici : ${persona.bookingLink}`;
  } else {
    text = (tool.input as { text: string }).text;
  }

  // Anti-race lock (compare-and-swap): send only if the conversation is STILL active AND nobody acted
  // since we read it. The old filter (agent_status='active' only) let TWO concurrent turns both win —
  // the status doesn't change between their reads, so both conditional updates matched and both sent.
  // CAS on the agent_last_acted_at value we read at turn start: only one update can match it, so only
  // one turn proceeds. Also still catches a human takeover (status flips → no match).
  // ⚠️ agent_last_acted_at is a CAS TOKEN: it MUST be written ONLY here/sendGreeting as a ms-ISO string.
  // Adding a DB trigger, a now() default, or any other writer would make .eq() stop matching and silently
  // reopen the double-send window. If a DB-side writer ever becomes necessary, switch to an int seq CAS.
  const prevActedAt = conv.agent_last_acted_at as string | null;
  let lockQuery = sb.from("conversations")
    .update({ agent_last_acted_at: new Date().toISOString() })
    .eq("id", conversationId).eq("agent_status", "active");
  lockQuery = prevActedAt === null
    ? lockQuery.is("agent_last_acted_at", null)
    : lockQuery.eq("agent_last_acted_at", prevActedAt);
  const { data: lock } = await lockQuery.select("id").maybeSingle();
  if (!lock) return; // taken over / paused / booked / another concurrent turn won — do not send.

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
    await logMessageActivity(sb, conversationId, { direction: "outbound", channel: conv.channel as Channel, sentBy: "agent", body: text });
  } catch (e) {
    console.error("[inbox.agent] send failed:", e);
    await escalateConversation(conversationId, "low_confidence", "Échec d'envoi de la réponse de l'agent.");
  }
}
