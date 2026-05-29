import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canInvoice, getCurrentMember } from "@/lib/adv-permissions";

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface ScheduleLine {
  month: string; // "YYYY-MM-01"
  amount: number; // HT
}
interface Body {
  fundingType?: string;
  clientName?: string;
  lines: ScheduleLine[];
}

/**
 * Échéances déjà engagées dans Pennylane — jamais réécrites/supprimées.
 * Le delete-then-insert ne touche que les statuts "ré-planifiables".
 */
const LOCKED_STATUSES = ["facture", "encaisse"];
const REPLACEABLE_STATUSES = ["planifie", "non_fait", "a_valider"];

/**
 * Année fiscale LCA (sept→août), format "YYYY-YYYY" — aligné sur billing-grid.tsx.
 * Un mois >= septembre appartient à l'exercice "année courante - année suivante".
 */
function fiscalYearForMonth(month: string): string {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const m = Number(monthStr); // 1-12
  const startYear = m >= 9 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canInvoice(member)) {
    return NextResponse.json(
      { error: "Forbidden — seuls Admin ou Finance peuvent programmer la facturation" },
      { status: 403 },
    );
  }

  const { id: dealId } = await ctx.params;
  if (!dealId) {
    return NextResponse.json({ error: "deal id manquant dans l'URL" }, { status: 400 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ error: "Au moins une échéance requise" }, { status: 400 });
  }
  for (const l of body.lines) {
    if (!l.month || typeof l.amount !== "number" || l.amount <= 0) {
      return NextResponse.json(
        { error: "Chaque échéance doit avoir un mois et un montant > 0" },
        { status: 400 },
      );
    }
  }

  const { data: deal, error: dealErr } = await serviceClient
    .from("deals")
    .select("id, name, company_id")
    .eq("id", dealId)
    .maybeSingle();
  if (dealErr) {
    return NextResponse.json({ error: dealErr.message }, { status: 500 });
  }
  if (!deal) {
    return NextResponse.json({ error: `Deal ${dealId} introuvable` }, { status: 404 });
  }

  const { data: company } = await serviceClient
    .from("companies")
    .select("id, name")
    .eq("id", deal.company_id)
    .maybeSingle();

  const { data: existingEntry } = await serviceClient
    .from("billing_entries")
    .select("id")
    .eq("deal_id", dealId)
    .maybeSingle();

  // Année fiscale dérivée de la 1re échéance (la plus ancienne).
  const earliestMonth = body.lines
    .map((l) => l.month)
    .sort()[0];

  const entryPayload = {
    company_id: deal.company_id,
    deal_id: dealId,
    client_name: body.clientName?.trim() || company?.name || deal.name || "Client",
    funding_type: body.fundingType ?? "Direct",
    fiscal_year: fiscalYearForMonth(earliestMonth),
    updated_at: new Date().toISOString(),
  };

  let entryId: string;
  if (existingEntry?.id) {
    entryId = existingEntry.id;
    const { error: updErr } = await serviceClient
      .from("billing_entries")
      .update(entryPayload)
      .eq("id", entryId);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
  } else {
    const { data: created, error: createErr } = await serviceClient
      .from("billing_entries")
      .insert(entryPayload)
      .select("id")
      .single();
    if (createErr) {
      return NextResponse.json({ error: createErr.message }, { status: 500 });
    }
    entryId = created.id;
  }

  // Ne jamais clobber une échéance déjà facturée/encaissée.
  const { data: existingMonths } = await serviceClient
    .from("billing_months")
    .select("month, status")
    .eq("billing_entry_id", entryId);
  const locked = new Set(
    (existingMonths ?? [])
      .filter((m) => LOCKED_STATUSES.includes(m.status as string))
      .map((m) => m.month as string),
  );

  const rows = body.lines
    .filter((l) => !locked.has(l.month))
    .map((l) => ({
      billing_entry_id: entryId,
      month: l.month,
      amount: l.amount,
      status: "planifie",
    }));

  // Remplace uniquement les échéances ré-planifiables (les lock restent intactes).
  const { error: delErr } = await serviceClient
    .from("billing_months")
    .delete()
    .eq("billing_entry_id", entryId)
    .in("status", REPLACEABLE_STATUSES);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  if (rows.length) {
    const { error: insErr } = await serviceClient.from("billing_months").insert(rows);
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
  }

  await serviceClient.from("activities").insert({
    type: "note",
    title: "[ADV] Plan de facturation programmé",
    description: `${rows.length} échéance(s) planifiée(s) pour "${deal.name ?? deal.id}" (${entryPayload.funding_type}).`,
    company_id: deal.company_id,
    team_member_id: member.id,
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({
    ok: true,
    billing_entry_id: entryId,
    scheduled: rows.length,
    locked: locked.size,
  });
}
