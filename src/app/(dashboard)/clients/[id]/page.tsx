import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { notFound } from "next/navigation";
import { CompanyDetail } from "@/components/commercial/company-detail";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: c } = await supabase.from("companies").select("name").eq("id", id).single();
  return { title: c ? c.name : "Fiche Client" };
}

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: company } = await supabase
    .from("companies")
    .select("*, company_types(id, name), team_members!companies_owner_id_fkey(id, first_name, last_name)")
    .eq("id", id)
    .single();

  if (!company) notFound();

  const [
    { data: contacts },
    { data: deals },
    { data: activities },
    { data: meetings },
    { data: orders },
    { data: billingEntries },
    { data: sessions },
    { data: learners },
    { data: companyTypes },
    { data: teamMembers },
    { data: servicePlans },
    { data: quotations },
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select("*")
      .eq("company_id", id)
      .order("last_name"),
    supabase
      .from("deals")
      .select("*, contacts(first_name, last_name), team_members(first_name, last_name)")
      .eq("company_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("activities")
      .select("*, team_members(first_name, last_name), contacts(first_name, last_name)")
      .eq("company_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("meetings")
      .select("*, contacts(first_name, last_name), team_members!meetings_assigned_to_fkey(first_name, last_name)")
      .eq("company_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("deals")
      .select("*, team_members(first_name, last_name), lead_sources(name)")
      .eq("company_id", id)
      .eq("stage", "closed_won")
      .order("close_date", { ascending: false }),
    supabase
      .from("billing_entries")
      .select("*, billing_months(*)")
      .eq("company_id", id)
      .order("client_name"),
    supabase
      .from("sessions")
      .select("*, session_themes(name), team_members(first_name, last_name)")
      .eq("company_id", id)
      .order("session_date", { ascending: false }),
    supabase
      .from("learners")
      .select("*, training_programs(name), training_types(name)")
      .eq("company_id", id)
      .order("last_name"),
    supabase
      .from("company_types")
      .select("id, name")
      .order("name"),
    supabase
      .from("team_members")
      .select("id, first_name, last_name")
      .eq("is_active", true),
    supabase
      .from("service_plans")
      .select("*, training_programs(name), training_types(name), training_sessions(*, training_session_learners(learner_id, learners(first_name, last_name))), service_plan_learners(learner_id, learners(first_name, last_name))")
      .eq("company_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("quotations")
      .select("*")
      .eq("company_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <>
      <Header title={company.name} />
      <CompanyDetail
        company={company}
        contacts={contacts ?? []}
        deals={deals ?? []}
        activities={activities ?? []}
        meetings={meetings ?? []}
        orders={orders ?? []}
        billingEntries={billingEntries ?? []}
        sessions={sessions ?? []}
        learners={learners ?? []}
        companyTypes={companyTypes ?? []}
        teamMembers={teamMembers ?? []}
        servicePlans={servicePlans ?? []}
        quotations={quotations ?? []}
      />
    </>
  );
}
