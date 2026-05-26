import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canViewADVStatus, getCurrentMember } from "@/lib/adv-permissions";

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const member = await getCurrentMember();
  if (!canViewADVStatus(member)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: dealId } = await params;
  if (!dealId) {
    return NextResponse.json({ error: "deal id manquant" }, { status: 400 });
  }

  const { data: deal, error: dealErr } = await serviceClient
    .from("deals")
    .select(
      "id, name, stage, amount, is_invoiced, is_paid, pennylane_quote_id, pennylane_invoice_id, contact_id, company_id, owner_id, training_days, program_id, training_type_id, created_at, updated_at",
    )
    .eq("id", dealId)
    .maybeSingle();

  if (dealErr) {
    return NextResponse.json({ error: dealErr.message }, { status: 500 });
  }
  if (!deal) {
    return NextResponse.json({ error: `Deal ${dealId} introuvable` }, { status: 404 });
  }

  const { data: billingMonths } = await serviceClient
    .from("billing_months")
    .select("id, month, amount, status, created_at")
    .eq("deal_id", dealId)
    .order("month", { ascending: true });

  const quoteStatus = deal.pennylane_quote_id ? "emitted" : "none";
  const invoiceStatus = deal.is_paid
    ? "paid"
    : deal.is_invoiced
      ? "emitted"
      : deal.pennylane_invoice_id
        ? "emitted"
        : "none";

  return NextResponse.json({
    deal_id: deal.id,
    deal_name: deal.name,
    stage: deal.stage,
    amount: deal.amount,
    quote: {
      status: quoteStatus,
      pennylane_quote_id: deal.pennylane_quote_id,
    },
    invoice: {
      status: invoiceStatus,
      is_invoiced: deal.is_invoiced,
      is_paid: deal.is_paid,
      pennylane_invoice_id: deal.pennylane_invoice_id,
    },
    billing_months: billingMonths ?? [],
    nomenclature: {
      program_id: deal.program_id,
      training_type_id: deal.training_type_id,
      complete: !!deal.program_id && !!deal.training_type_id,
    },
    updated_at: deal.updated_at,
  });
}
