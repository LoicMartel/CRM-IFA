import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canCreateQuote, getCurrentMember } from "@/lib/adv-permissions";
import { defaultQuoteLines, type QuoteLineDraft } from "@/lib/adv-quote";
import { listProducts } from "@/lib/pennylane-client";

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(
  req: Request,
  ctx: { params: Promise<{ dealId: string }> },
) {
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { dealId } = await ctx.params;
  const { data: deal } = await serviceClient
    .from("deals")
    .select("id, name, amount, training_days, notes, owner_id, quote_lines, quote_subject, quote_pdf_description")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: `Deal ${dealId} introuvable` }, { status: 404 });
  if (!canCreateQuote(member, deal)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const products = await listProducts();
  const lines: QuoteLineDraft[] =
    Array.isArray(deal.quote_lines) && deal.quote_lines.length > 0
      ? (deal.quote_lines as QuoteLineDraft[])
      : defaultQuoteLines(
          { id: deal.id, name: deal.name, amount: deal.amount, training_days: deal.training_days, notes: deal.notes },
          products,
        );

  const catalog = products
    .filter((p) => p.reference)
    .map((p) => ({ ref: p.reference as string, label: p.label ?? p.reference, id: p.id }));

  // Mode "depuis cotation" : pré-remplit le total (total_ht) en une seule ligne principale
  // (le détail/coeffs internes de la cotation ne sont pas exposés au client). Éditable ensuite.
  const fromQuotation = new URL(req.url).searchParams.get("fromQuotation");
  if (fromQuotation) {
    const { data: q } = await serviceClient
      .from("quotations").select("total_ht, nb_learners").eq("id", fromQuotation).maybeSingle();
    if (q) {
      const total = Number(q.total_ht ?? 0);
      const mainLine: QuoteLineDraft = {
        kind: "main", product_ref: null,
        label: `Formation — ${q.nb_learners ?? 1} apprenant(s)`,
        quantity: 1, unit: "unité", unit_price: total.toFixed(2), vat_rate: "FR_200", description: null,
      };
      return NextResponse.json({ lines: [mainLine], subject: null, description: null, catalog });
    }
  }

  return NextResponse.json({
    lines,
    subject: deal.quote_subject ?? null,
    description: deal.quote_pdf_description ?? null,
    catalog,
  });
}
