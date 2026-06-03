import { svc } from "./ingest";
import { AGENT_CHANNELS, type Channel, type EscalationReason } from "./types";

export interface EligibilityVerdict {
  eligible: boolean;            // true => agent_status reste 'active', l'agent peut répondre
  reason: EscalationReason | null; // si non éligible, pourquoi (sert d'escalation_reason)
}

/**
 * Déterministe, AVANT tout appel IA. Décide si l'agent peut traiter cette conversation.
 * - LinkedIn => jamais full-auto (anti-ban) => escalade.
 * - Canal hors AGENT_CHANNELS (ex: sms) => non éligible (laisser en human).
 * - Contact existant (a un deal) => human, pas de réponse auto.
 * - Mot-clé Rafi présent dans le dernier message inbound => escalade.
 */
export async function evaluateEligibility(
  conversationId: string,
  isExistingContact: boolean,
  channel: Channel,
  lastInboundBody: string
): Promise<EligibilityVerdict> {
  if (channel === "linkedin") return { eligible: false, reason: "linkedin" };
  if (!AGENT_CHANNELS.includes(channel)) return { eligible: false, reason: null };
  if (isExistingContact) return { eligible: false, reason: "existing_contact" };

  const sb = svc();
  const { data: kws } = await sb.from("agent_escalation_keywords").select("keyword").eq("active", true);
  const body = lastInboundBody.toLowerCase();
  if (kws?.some((k) => k.keyword && body.includes(k.keyword.toLowerCase()))) {
    return { eligible: false, reason: "keyword" };
  }
  return { eligible: true, reason: null };
}
