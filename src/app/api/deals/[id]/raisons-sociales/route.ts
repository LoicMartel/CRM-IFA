import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentMember } from "@/lib/adv-permissions";
import { listCompanyRaisonsSociales, resolveBeneficiary } from "@/lib/adv-raison-sociale";

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * Entités rattachées à l'entreprise du deal, pour les sélecteurs devis + convention.
 * `company` porte le repli utilisé quand aucune entité n'est choisie.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: dealId } = await ctx.params;
  const { data: deal } = await serviceClient
    .from("deals")
    .select("id, company_id, raison_sociale_id")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: `Deal ${dealId} introuvable` }, { status: 404 });
  if (!deal.company_id) {
    return NextResponse.json({ selected_id: null, company: null, raisons_sociales: [] });
  }

  const [options, fallback] = await Promise.all([
    listCompanyRaisonsSociales(serviceClient, deal.company_id),
    resolveBeneficiary(serviceClient, deal.company_id, null),
  ]);

  return NextResponse.json({
    selected_id: deal.raison_sociale_id ?? null,
    company: fallback && {
      name: fallback.name,
      siret: fallback.siret,
      address: [fallback.address, fallback.city].filter(Boolean).join(", ") || null,
      learner_names: fallback.learnerNames,
    },
    raisons_sociales: options.map((o) => ({
      id: o.id,
      name: o.name,
      siret: o.siret,
      address: o.address,
      learner_names: o.learnerNames,
    })),
  });
}
