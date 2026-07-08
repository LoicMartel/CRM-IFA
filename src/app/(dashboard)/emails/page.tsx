import { createClient } from "@/lib/supabase/server";
import { EmailsClient, type EmailRow } from "./emails-client";

// Journal d'audit des emails sortants (preuve Qualiopi). Lecture RLS (équipe authentifiée).
export default async function EmailsPage() {
  const sb = await createClient();
  const { data } = await sb
    .from("email_log")
    .select("id, recipient, subject, body, transporter, status, error, has_attachments, attachment_count, related_entity_type, related_entity_id, source, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  return <EmailsClient initial={(data ?? []) as EmailRow[]} />;
}
