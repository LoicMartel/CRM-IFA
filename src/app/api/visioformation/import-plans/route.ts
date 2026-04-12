import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PlanPayload {
  companyId: string;
  format: "individuel" | "collectif";
  mode: "presentiel" | "distanciel" | "mixte";
  vtPlanned: number;
  daysPlanned: number;
  startDate: string | null;
  endDate: string | null;
  learnerIds: string[];
}

export async function POST(request: Request) {
  const { plans } = (await request.json()) as { plans: PlanPayload[] };

  let created = 0;
  const errors: string[] = [];

  for (const plan of plans) {
    try {
      // Check for existing plan for this company
      const { data: existing } = await supabase
        .from("service_plans")
        .select("id")
        .eq("company_id", plan.companyId)
        .maybeSingle();

      if (existing) {
        // Fetch company name for error message
        const { data: company } = await supabase
          .from("companies")
          .select("name")
          .eq("id", plan.companyId)
          .single();
        errors.push(`${company?.name ?? plan.companyId}: un plan existe déjà, ignoré`);
        continue;
      }

      // Get primary contact info
      const { data: company } = await supabase
        .from("companies")
        .select("name, primary_contact_id, contacts!companies_primary_contact_id_fkey(first_name, last_name, phone, email)")
        .eq("id", plan.companyId)
        .single();

      const contact = company?.contacts
        ? (Array.isArray(company.contacts) ? company.contacts[0] : company.contacts)
        : null;

      const { data: newPlan, error } = await supabase
        .from("service_plans")
        .insert({
          company_id: plan.companyId,
          format: plan.format,
          mode: plan.mode,
          vt_planned: plan.vtPlanned,
          days_planned: plan.daysPlanned,
          start_date: plan.startDate,
          end_date: plan.endDate,
          manager_name: contact ? `${contact.first_name} ${contact.last_name}` : null,
          manager_phone: contact?.phone || null,
          manager_email: contact?.email || null,
        })
        .select("id")
        .single();

      if (error) {
        errors.push(`${company?.name ?? plan.companyId}: ${error.message}`);
        continue;
      }

      // Link learners
      if (newPlan && plan.learnerIds.length > 0) {
        const { error: linkError } = await supabase
          .from("service_plan_learners")
          .insert(
            plan.learnerIds.map((lid) => ({
              service_plan_id: newPlan.id,
              learner_id: lid,
            }))
          );

        if (linkError) {
          errors.push(`Apprenants pour ${company?.name ?? plan.companyId}: ${linkError.message}`);
        }
      }

      created++;
    } catch (e: any) {
      errors.push(`Plan: ${e.message}`);
    }
  }

  return NextResponse.json({ created, errors });
}
