import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CITY_REGION: Record<string, string> = {
  Paris: "Île-de-France", Mérignac: "Nouvelle-Aquitaine", Bordeaux: "Nouvelle-Aquitaine",
  Montpellier: "Occitanie", Toulouse: "Occitanie", Lyon: "Auvergne-Rhône-Alpes",
  Marseille: "Provence-Alpes-Côte d'Azur", Nantes: "Pays de la Loire", Lille: "Hauts-de-France",
  Strasbourg: "Grand Est", Rennes: "Bretagne", Nice: "Provence-Alpes-Côte d'Azur",
  Rouen: "Normandie", Dijon: "Bourgogne-Franche-Comté", "Clermont-Ferrand": "Auvergne-Rhône-Alpes",
  "La Rochelle": "Nouvelle-Aquitaine", Limoges: "Nouvelle-Aquitaine", Poitiers: "Nouvelle-Aquitaine",
  Orléans: "Centre-Val de Loire", Tours: "Centre-Val de Loire", Reims: "Grand Est",
  Amiens: "Hauts-de-France", Caen: "Normandie", Angers: "Pays de la Loire",
  Grenoble: "Auvergne-Rhône-Alpes", "Saint-Étienne": "Auvergne-Rhône-Alpes",
  Toulon: "Provence-Alpes-Côte d'Azur", "Aix-en-Provence": "Provence-Alpes-Côte d'Azur",
  Brest: "Bretagne", Perpignan: "Occitanie", Nîmes: "Occitanie", Pau: "Nouvelle-Aquitaine",
  Bayonne: "Nouvelle-Aquitaine", Metz: "Grand Est", Nancy: "Grand Est",
};

export async function POST(req: NextRequest) {
  try {
    const { expertise, city, budget, daysCount } = await req.json();

    const { data: teamMembers } = await supabase
      .from("team_members")
      .select("id, first_name, last_name, roles, expertises, city, region, tjm, days_per_week, preferred_days, mobility, google_calendar_id, google_calendar_id_presentiel")
      .eq("is_active", true);

    const experts = (teamMembers ?? []).filter((m: any) =>
      ((m.roles as string[]) ?? []).some((r: string) => r === "Expert" || r === "Experte") && m.tjm
    );

    const formationRegion = CITY_REGION[city] ?? "";
    const nbDays = parseFloat(daysCount) || 0;
    const budgetHT = parseFloat(budget) || 0;

    const scored = experts.map((m: any) => {
      const exps = (m.expertises as string[]) ?? [];
      const hasExpertise = expertise ? exps.includes(expertise) : false;
      const expertRegion = (m.region as string) || "";
      const sameRegion = !!(formationRegion && expertRegion && expertRegion === formationRegion);
      const tjm = Number(m.tjm) || 0;
      const costTjm = tjm * nbDays;
      const prepa = tjm * 0.5;
      const deplacement = sameRegion ? 0 : tjm * 0.5;
      const totalHT = costTjm + prepa + deplacement;
      const budgetOk = budgetHT > 0 ? totalHT <= budgetHT : true;
      const score = (hasExpertise ? 1 : 0) + (sameRegion ? 1 : 0) + (budgetOk ? 1 : 0);
      const marge = budgetHT > 0 ? budgetHT - totalHT : 0;

      return {
        id: m.id as string,
        firstName: m.first_name as string,
        lastName: m.last_name as string,
        name: `${m.first_name} ${m.last_name}`,
        expertises: exps,
        city: (m.city as string) || "",
        region: expertRegion,
        tjm,
        score,
        hasExpertise,
        sameRegion,
        budgetOk,
        costTjm,
        prepa,
        deplacement,
        totalHT,
        marge,
        hasCalendar: !!(m.google_calendar_id || m.google_calendar_id_presentiel),
      };
    }).sort((a, b) => b.score - a.score || a.totalHT - b.totalHT);

    // Top 2 recommandés
    const recommended = scored.slice(0, 2);
    const others = scored.slice(2);

    return NextResponse.json({
      success: true,
      recommended,
      others,
      formationRegion,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
