import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { notFound } from "next/navigation";
import { ContactDetail } from "@/components/commercial/contact-detail";

export const metadata = { title: "Fiche Contact" };

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: contact } = await supabase
    .from("contacts")
    .select("*, companies!contacts_company_id_fkey(id, name), team_members!contacts_owner_id_fkey(id, first_name, last_name)")
    .eq("id", id)
    .single();

  if (!contact) notFound();

  // Find training sessions for this contact (if they are a learner)
  let learnerSessions: any[] = [];
  if (contact.email) {
    const { data: learnerMatch } = await supabase
      .from("learners")
      .select("id")
      .eq("email", contact.email as string)
      .limit(1);
    if (learnerMatch && learnerMatch.length > 0) {
      const learnerId = learnerMatch[0].id;
      const { data: tsl } = await supabase
        .from("training_session_learners")
        .select("training_sessions(*, service_plans(companies(name), training_programs(name)))")
        .eq("learner_id", learnerId);
      learnerSessions = (tsl ?? []).map((r: any) => r.training_sessions).filter(Boolean);
    }
  }

  const [
    { data: deals },
    { data: companyDeals },
    { data: activities },
    { data: meetings },
    { data: companies },
    { data: teamMembers },
    { data: sources },
    { data: quotations },
  ] = await Promise.all([
    supabase
      .from("deals")
      .select("*, companies(name)")
      .eq("contact_id", id)
      .order("created_at", { ascending: false }),
    contact.company_id
      ? supabase
          .from("deals")
          .select("*, companies(name), contacts(first_name, last_name)")
          .eq("company_id", contact.company_id)
          .neq("contact_id", id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
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
      .select("id, first_name, last_name, roles")
      .eq("is_active", true),
    supabase
      .from("lead_sources")
      .select("id, name")
      .order("name"),
    supabase
      .from("quotations")
      .select("*")
      .eq("contact_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <>
      <Header title={`${contact.first_name} ${contact.last_name}`} />
      <ContactDetail
        contact={contact}
        deals={deals ?? []}
        companyDeals={companyDeals ?? []}
        activities={activities ?? []}
        meetings={meetings ?? []}
        companies={companies ?? []}
        teamMembers={teamMembers ?? []}
        sources={sources ?? []}
        learnerSessions={learnerSessions}
        quotations={quotations ?? []}
      />
    </>
  );
}
