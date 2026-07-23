import type { SupabaseClient } from "@supabase/supabase-js";
import type { Channel, SentBy } from "./types";

const CHANNEL_LABELS: Record<Channel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  messenger: "Messenger",
  sms: "SMS",
  web_form: "Formulaire web",
};

const SENDER_LABELS: Record<SentBy, string> = {
  lead: "Message reçu",
  agent: "Réponse de l'agent",
  human: "Message envoyé",
};

const MAX_DESCRIPTION = 500;

interface LogMessageOpts {
  direction: "inbound" | "outbound";
  channel: Channel;
  sentBy: SentBy;
  body: string;
  teamMemberId?: string | null;
}

/**
 * Trace best-effort un message d'inbox dans la timeline d'activités de la fiche contact
 * (+ entreprise si le contact en a une), pour que l'historique des échanges agent↔lead
 * remonte dans l'onglet « Activités ». Type dédié `message` (distinct des emails système
 * `email`) → repérable et filtrable. Ne bloque JAMAIS l'ingestion/l'envoi et dégrade
 * silencieusement si la conversation n'a pas de contact ou si la table est absente.
 */
export async function logMessageActivity(
  sb: SupabaseClient,
  conversationId: string,
  opts: LogMessageOpts,
): Promise<void> {
  try {
    const { data: conv } = await sb
      .from("conversations")
      .select("contact_id, contacts(company_id)")
      .eq("id", conversationId)
      .maybeSingle();

    const contactId = conv?.contact_id ?? null;
    if (!contactId) return; // pas de fiche à enrichir

    const contact = Array.isArray(conv?.contacts) ? conv?.contacts[0] : conv?.contacts;
    const companyId = (contact as { company_id: string | null } | null)?.company_id ?? null;

    const channelLabel = CHANNEL_LABELS[opts.channel] ?? opts.channel;
    const senderLabel = SENDER_LABELS[opts.sentBy] ?? "Message";
    const title = `${senderLabel} — ${channelLabel}`;
    const description = opts.body.trim().slice(0, MAX_DESCRIPTION);

    await sb.from("activities").insert({
      type: "message",
      title,
      description,
      contact_id: contactId,
      company_id: companyId,
      team_member_id: opts.teamMemberId ?? null,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[inbox.activity] logMessageActivity failed:", e);
  }
}
