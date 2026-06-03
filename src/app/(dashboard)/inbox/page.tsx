import { createClient } from "@/lib/supabase/server";
import { InboxClient, type Conv } from "./inbox-client";

export default async function InboxPage() {
  const sb = await createClient();
  const { data } = await sb.from("conversations")
    .select("id, channel, category, intent, agent_status, escalation_reason, unread, subject, last_message_at, contacts(first_name,last_name,email)")
    .order("last_message_at", { ascending: false }).limit(200);
  // The conversations table isn't in the generated DB types yet → the typed client infers the
  // embedded contact as an array. Normalize to a single object to match the Conv shape.
  const initial = (data ?? []).map((c) => ({
    ...c,
    contacts: Array.isArray(c.contacts) ? (c.contacts[0] ?? null) : c.contacts,
  })) as Conv[];
  return <InboxClient initial={initial} />;
}
