import { createClient } from "@/lib/supabase/server";
import { listClassifyAccountIds } from "@/lib/inbox/routing";
import { TriCourrierClient, type TriConv } from "./tri-courrier-client";

// Vue de tri du courrier de Rafel (chantier C) — séparée de l'inbox leads. Source = conversations des
// comptes en mode `classify`. Lecture seule : aucune réponse n'est envoyée depuis cette boîte.
export default async function TriCourrierPage() {
  const sb = await createClient();
  const ids = await listClassifyAccountIds();
  let initial: TriConv[] = [];
  if (ids.length > 0) {
    const { data } = await sb.from("conversations")
      .select("id, channel, subject, last_message_at, unread, triage_folder, triage_action_required, triage_assignee, triage_folder_reason, contacts(first_name,last_name,email)")
      .in("account_id", ids)
      .order("last_message_at", { ascending: false }).limit(200);
    initial = (data ?? []).map((c) => ({
      ...c,
      contacts: Array.isArray(c.contacts) ? (c.contacts[0] ?? null) : c.contacts,
    })) as TriConv[];
  }
  return <TriCourrierClient initial={initial} />;
}
