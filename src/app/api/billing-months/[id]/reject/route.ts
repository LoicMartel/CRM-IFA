import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canValidateAdv, getCurrentMember } from "@/lib/adv-permissions";
import { deleteInvoice, PennylaneError } from "@/lib/pennylane-client";

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canValidateAdv(member))
    return NextResponse.json({ error: "Forbidden — Admin ou Finance requis" }, { status: 403 });
  const { id: bmId } = await ctx.params;

  const { data: bm } = await serviceClient
    .from("billing_months")
    .select("id, status, pennylane_invoice_id")
    .eq("id", bmId)
    .maybeSingle();
  if (!bm) return NextResponse.json({ error: `Échéance ${bmId} introuvable` }, { status: 404 });
  if (bm.status !== "a_valider") {
    return NextResponse.json(
      { error: `Échéance pas en attente (status=${bm.status})` },
      { status: 409 },
    );
  }

  if (bm.pennylane_invoice_id) {
    try {
      await deleteInvoice(Number(bm.pennylane_invoice_id));
    } catch (e) {
      if (!(e instanceof PennylaneError && e.status === 422))
        console.error("reject bm: delete draft failed", e);
    }
  }
  await serviceClient
    .from("billing_months")
    .update({ status: "planifie", pennylane_invoice_id: null, updated_at: new Date().toISOString() })
    .eq("id", bmId);
  return NextResponse.json({
    ok: true,
    billing_month_id: bmId,
    message: "Facture rejetée — échéance repassée en planifié.",
  });
}
