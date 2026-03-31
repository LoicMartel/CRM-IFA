import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { notFound } from "next/navigation";
import { ContactDetail } from "@/components/commercial/contact-detail";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: contact } = await supabase
    .from("contacts")
    .select("*, companies!contacts_company_id_fkey(id, name), team_members!contacts_owner_id_fkey(id, first_name, last_name)")
    .eq("id", id)
    .single();

  if (!contact) notFound();

  const [
    { data: deals },
    { data: activities },
    { data: meetings },
    { data: companies },
    { data: teamMembers },
    { data: sources },
  ] = await Promise.all([
    supabase
      .from("deals")
      .select("*, companies(name)")
      .eq("contact_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("activities")
      .select("*, team_members(first_name, last_name)")
      .eq("contact_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("meetings")
      .select("*, team_members!meetings_assigned_to_fkey(first_name, last_name)")
      .eq("contact_id", id)
      .order("scheduled_at", { ascending: false }),
    supabase
      .from("companies")
      .select("id, name")
      .order("name"),
    supabase
      .from("team_members")
      .select("id, first_name, last_name")
      .eq("is_active", true),
    supabase
      .from("lead_sources")
      .select("id, name")
      .order("name"),
  ]);

  return (
    <>
      <Header title={`${contact.first_name} ${contact.last_name}`} />
      <ContactDetail
        contact={contact}
        deals={deals ?? []}
        activities={activities ?? []}
        meetings={meetings ?? []}
        companies={companies ?? []}
        teamMembers={teamMembers ?? []}
        sources={sources ?? []}
      />
    </>
  );
}
