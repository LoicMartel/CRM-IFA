import { svc } from "./ingest";
import { createNotification } from "@/lib/notifications";
import type { EscalationReason } from "./types";

const REASON_LABEL: Record<EscalationReason, string> = {
  high_value: "Lead à forte valeur / signal d'achat",
  explicit_human: "Demande à parler à un humain",
  low_confidence: "Doute de l'agent IA",
  keyword: "Critère prioritaire de Rafi",
  off_script: "Question hors-script",
  negative: "Signal négatif / réclamation",
  existing_contact: "Contact/deal déjà existant",
  linkedin: "Lead LinkedIn (réponse manuelle requise)",
};

// Catégorie de post pour les escalades. Valeur réelle de l'enum PostCategory (src/types/database.ts) :
// "lead_gen" = génération/traitement de leads → la plus adaptée pour un lead à reprendre.
const ESCALATION_POST_CATEGORY = process.env.INBOX_ESCALATION_POST_CATEGORY ?? "lead_gen";

export async function escalateConversation(
  conversationId: string,
  reason: EscalationReason,
  summary: string
): Promise<void> {
  const sb = svc();
  const { data: conv } = await sb.from("conversations")
    .select("channel, owner_id, contacts(first_name,last_name)").eq("id", conversationId).maybeSingle();
  if (!conv) return;

  await sb.from("conversations").update({ agent_status: "escalated", escalation_reason: reason, unread: true }).eq("id", conversationId);

  const who = (Array.isArray(conv.contacts) ? conv.contacts[0] : conv.contacts) as { first_name?: string; last_name?: string } | null;
  const leadName = `${who?.first_name ?? ""} ${who?.last_name ?? ""}`.trim() || "un lead";
  const title = `🔴 Lead à reprendre — ${leadName} (${conv.channel})`;
  const body = `${REASON_LABEL[reason]}.\n${summary}`;

  // Post dans le feed d'équipe (author = owner). Slack suit via l'intégration posts existante.
  if (conv.owner_id) {
    await sb.from("posts").insert({
      author_id: conv.owner_id,
      title,
      content: body,
      category: ESCALATION_POST_CATEGORY,
    });
    // Notification cloche ciblée → lien direct vers le thread inbox
    await createNotification({
      recipientId: conv.owner_id,
      type: "new_lead",
      title,
      body: summary,
      linkUrl: `/inbox/${conversationId}`,
      relatedEntityType: "conversation",
      relatedEntityId: conversationId,
    });
  } else {
    // Fail loud: without an owner the escalation produces no feed post and no bell — it would
    // otherwise vanish silently (only discoverable by manually opening /inbox).
    console.error(`[inbox.escalation] no owner resolved for conversation ${conversationId} (reason=${reason}) — NO feed post / bell sent. Check INBOX_DEFAULT_OWNER_EMAIL.`);
  }
}
