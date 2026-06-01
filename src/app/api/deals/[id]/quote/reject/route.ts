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
    .from("deals").select("id, name, stage, contact_id, company_id, pennylane_quote_id, quote_number")
    .eq("id", dealId).maybeSingle();
  if (!deal) return NextResponse.json({ error: `Deal ${dealId} introuvable` }, { status: 404 });
  if (deal.stage !== "quote_to_validate") {
    return NextResponse.json({ error: `Deal pas en attente (stage=${deal.stage})` }, { status: 409 });
  }

  // Nettoie le .docx devis rejeté : supprime les fichiers du bucket puis les lignes DB.
  try {
    const { data: devisDocs } = await serviceClient
      .from("deal_documents").select("id, file_path")
      .eq("deal_id", dealId).eq("document_type", "devis");
    if (devisDocs?.length) {
      await serviceClient.storage.from("deal-documents").remove(devisDocs.map((d) => d.file_path));
      await serviceClient.from("deal_documents").delete().in("id", devisDocs.map((d) => d.id));
    }
  } catch (e) { console.error("reject devis: cleanup deal_documents failed", e); }

  // Ré-ouvre la préparation : repasse en quote_to_send, libère pennylane_quote_id
  // pour qu'une régénération crée un nouveau quote versionné.
  await serviceClient.from("deals").update({
    stage: "quote_to_send", pennylane_quote_id: null, updated_at: new Date().toISOString(),
  }).eq("id", dealId);

  await serviceClient.from("activities").insert({
    type: "note", title: "[ADV] Devis rejeté",
    description: `Devis rejeté par la Finance (aperçu). Devis ${deal.quote_number ?? "sans numéro"} abandonné (jamais envoyé). Deal repassé en quote_to_send.`,
    contact_id: deal.contact_id, company_id: deal.company_id,
    team_member_id: member.id, created_at: new Date().toISOString(),
  });

  void req;
  return NextResponse.json({ ok: true, deal_id: dealId, message: "Devis rejeté — repassé en quote_to_send." });
}
