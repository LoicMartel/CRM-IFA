import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.nb_learners || !body.months) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const data = {
      deal_id: body.deal_id || null,
      company_id: body.company_id || null,
      company_name: body.company_name || null,
      contact_id: body.contact_id || null,
      contact_name: body.contact_name || null,
      nb_learners: body.nb_learners,
      months: body.months,
      nb_rise_up: body.nb_rise_up ?? 0,
      tjm_lca: body.tjm_lca,
      base_coeff: body.base_coeff,
      travel_coeff: body.travel_coeff,
      prep_coeff: body.prep_coeff,
      cost_per_day_presentiel: body.cost_per_day_presentiel,
      rise_up_cost_per_license: body.rise_up_cost_per_license,
      vt_duration_hours: body.vt_duration_hours,
      presentiel_hours_per_day: body.presentiel_hours_per_day,
      total_ht: body.total_ht,
      total_presentiel_days: body.total_presentiel_days,
      total_vt_sessions: body.total_vt_sessions,
      total_hours_formation: body.total_hours_formation,
      total_hours_intervention: body.total_hours_intervention,
      total_hours_mobilisation: body.total_hours_mobilisation,
      notes: body.notes || null,
    };

    let result;
    if (body.id) {
      const { data: updated, error } = await supabase
        .from("quotations")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", body.id)
        .select("id")
        .single();
      if (error) throw error;
      result = updated;
    } else {
      const { data: inserted, error } = await supabase
        .from("quotations")
        .insert(data)
        .select("id")
        .single();
      if (error) throw error;
      result = inserted;
    }

    return NextResponse.json({ success: true, id: result.id });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
