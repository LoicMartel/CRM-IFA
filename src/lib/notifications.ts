import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type NotificationType =
  // Posts
  | "post_mention"
  | "post_comment"
  | "post_reaction"
  | "comment_reply"
  | "post_pinned"
  // Sessions (formation)
  | "session_assigned"
  | "session_cancelled"
  | "session_learner_added"
  | "session_reminder"
  | "session_unclosed"
  // Meetings (commercial)
  | "meeting_assigned"
  | "meeting_cancelled"
  | "meeting_noshow"
  | "meeting_reminder"
  | "meeting_unclosed"
  // Tasks
  | "task_assigned"
  | "task_overdue"
  | "task_due_soon"
  | "task_completed"
  // Business
  | "deal_stage_changed"
  | "stripe_payment"
  | "new_lead"
  | "new_review"
  // Social
  | "birthday";

export interface CreateNotificationInput {
  recipientId: string;
  type: NotificationType;
  title: string;
  body?: string;
  linkUrl?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  actorId?: string;
}

/**
 * Creates a notification for a team member. Best-effort: logs on failure but never throws.
 * Skips if recipientId === actorId (don't notify someone about their own action).
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  if (input.actorId && input.actorId === input.recipientId) return;

  const { error } = await supabase.from("notifications").insert({
    recipient_id: input.recipientId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    link_url: input.linkUrl ?? null,
    related_entity_type: input.relatedEntityType ?? null,
    related_entity_id: input.relatedEntityId ?? null,
    actor_id: input.actorId ?? null,
  });

  if (error) {
    console.error("[notifications] insert failed:", error.message, input);
  }
}

/**
 * Bulk-create multiple notifications at once.
 */
export async function createNotifications(inputs: CreateNotificationInput[]): Promise<void> {
  const rows = inputs
    .filter((i) => !i.actorId || i.actorId !== i.recipientId)
    .map((i) => ({
      recipient_id: i.recipientId,
      type: i.type,
      title: i.title,
      body: i.body ?? null,
      link_url: i.linkUrl ?? null,
      related_entity_type: i.relatedEntityType ?? null,
      related_entity_id: i.relatedEntityId ?? null,
      actor_id: i.actorId ?? null,
    }));

  if (rows.length === 0) return;

  const { error } = await supabase.from("notifications").insert(rows);
  if (error) {
    console.error("[notifications] bulk insert failed:", error.message, rows.length);
  }
}
