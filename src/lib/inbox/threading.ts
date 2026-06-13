import type { SupabaseClient } from "@supabase/supabase-js";

const RE_PREFIX = /^\s*(re|ref|fwd|fw|tr)\s*(\[\d+\])?\s*:\s*/i;

/** Strip leading reply/forward prefixes (Re:, RE:, Fwd:, Fw:, Tr:), repeatably + flatten newlines. */
export function normalizeSubject(subject: string): string {
  let s = subject;
  while (RE_PREFIX.test(s)) s = s.replace(RE_PREFIX, "");
  return s.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

export interface EmailReplyTarget {
  subject: string | null;
  replyTo: string | null;
}

/**
 * For an email/web_form conversation, compute the in-thread reply target:
 * - subject: "Re: <normalized conversation subject>" (null if the conversation has no subject)
 * - replyTo: Unipile id of the latest INBOUND email message, so the provider threads the reply.
 */
export async function resolveEmailReply(
  sb: SupabaseClient,
  conversationId: string
): Promise<EmailReplyTarget> {
  const { data: conv } = await sb
    .from("conversations")
    .select("subject")
    .eq("id", conversationId)
    .maybeSingle();
  // Only a real Unipile email id can be a reply target. Skip synthetic web_form ids
  // (`webform-{email}-{ts}`, set by the leads inbound route) — they are not Unipile messages.
  const { data: lastInbound } = await sb
    .from("messages")
    .select("external_message_id")
    .eq("conversation_id", conversationId)
    .eq("direction", "inbound")
    .not("external_message_id", "is", null)
    .not("external_message_id", "like", "webform-%")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const rawSubject = (conv as { subject: string | null } | null)?.subject ?? null;
  const subject = rawSubject ? `Re: ${normalizeSubject(rawSubject)}` : null;
  const replyTo = (lastInbound as { external_message_id: string | null } | null)?.external_message_id ?? null;
  return { subject, replyTo };
}
