// src/app/api/deals/[id]/quote/reject/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canValidateAdv, getCurrentMember } from "@/lib/adv-permissions";

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canValidateAdv(member)) {
    return NextResponse.json({ error: "Forbidden — Admin ou Finance requis" }, { status: 403 });
  }
  const { id: dealId } = await ctx.params;
  const { data: deal } = await serviceClient
    .from("deals").select("id, name, stage, contact_id, company_id, pennylane_quote_id")
    .eq("id", dealId).maybeSingle();
  if (!deal) return NextResponse.json({ error: `Deal ${dealId} introuvable` }, { status: 404 });
  if (deal.stage !== "quote_to_validate") {
    return NextResponse.json({ error: `Deal pas en attente (stage=${deal.stage})` }, { status: 409 });
  }

  // Quote non supprimable côté Pennylane → on le laisse (jamais envoyé) et on
  // ré-ouvre la préparation : repasse en quote_to_send, libère pennylane_quote_id
  // pour qu'une régénération crée un nouveau quote versionné.
  await serviceClient.from("deals").update({
    stage: "quote_to_send", pennylane_quote_id: null, updated_at: new Date().toISOString(),
  }).eq("id", dealId);

  await serviceClient.from("activities").insert({
    type: "note", title: "[ADV] Devis rejeté",
    description: `Devis rejeté par la Finance (aperçu). Quote Pennylane ${deal.pennylane_quote_id ?? "?"} abandonné (jamais envoyé). Deal repassé en quote_to_send.`,
    contact_id: deal.contact_id, company_id: deal.company_id,
    team_member_id: member.id, created_at: new Date().toISOString(),
  });

  // Nettoie le PDF deal_documents du devis rejeté (best-effort)
  try {
    await serviceClient.from("deal_documents").delete().eq("deal_id", dealId).eq("document_type", "devis");
  } catch (e) { console.error("reject devis: cleanup deal_documents failed", e); }

  void req;
  return NextResponse.json({ ok: true, deal_id: dealId, message: "Devis rejeté — repassé en quote_to_send." });
}
