import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentMember } from "@/lib/adv-permissions";
import { visioformationConfigured, buildFormationPayload, pushToVisioformation } from "@/lib/visioformation-client";

// CRM → VisioFormation : pousse une FORMATION (service_plan) + ses apprenants vers VisioFormation.
// Déclenché manuellement (bouton « Envoyer à VisioFormation » sur la fiche formation — V1).
// GATED : 503 tant que VF_API_URL/VF_API_KEY ne sont pas posés → inerte sans creds.
const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!visioformationConfigured()) {
    return NextResponse.json({ error: "VisioFormation non configuré (VF_API_URL / VF_API_KEY absents)" }, { status: 503 });
  }

  const { id } = await ctx.params;
  const { data: plan } = await serviceClient
    .from("service_plans")
    .select(`
      id, mode, format, vt_planned, days_planned, primary_trainer_id,
      companies(name, siret, address, city),
      training_programs(name),
      training_sessions(
        session_date, session_type, duration_hours, status, session_location,
        training_session_learners(learners(first_name, last_name, email, phone, position))
      )
    `)
    .eq("id", id)
    .maybeSingle();

  if (!plan) return NextResponse.json({ error: `Formation ${id} introuvable` }, { status: 404 });

  // Formateur principal (primary_trainer_id → team_members). Best-effort (null si non affecté).
  const planAny = plan as Record<string, unknown>;
  let trainer: { first_name?: string | null; last_name?: string | null; email?: string | null } | null = null;
  if (planAny.primary_trainer_id) {
    const { data: t } = await serviceClient
      .from("team_members")
      .select("first_name, last_name, email")
      .eq("id", planAny.primary_trainer_id as string)
      .maybeSingle();
    trainer = t ?? null;
  }

  const environment = process.env.VF_ENVIRONMENT ?? "preprod";
  const payload = buildFormationPayload(planAny as never, trainer, new Date().toISOString(), environment);

  // Garde-fou : une formation sans aucun apprenant n'a rien à créer côté VF.
  if (payload.apprenants.length === 0) {
    return NextResponse.json({ error: "Aucun apprenant sur cette formation — envoi annulé." }, { status: 422 });
  }

  const result = await pushToVisioformation(payload);
  if (!result.ok) {
    return NextResponse.json({ error: "Échec de l'envoi à VisioFormation", status: result.status, body: result.body }, { status: 502 });
  }
  return NextResponse.json({
    ok: true,
    external_reference: payload.meta.external_reference,
    vfId: result.vfId,
    apprenants: payload.apprenants.length,
    sessions: payload.sessions.length,
  });
}
