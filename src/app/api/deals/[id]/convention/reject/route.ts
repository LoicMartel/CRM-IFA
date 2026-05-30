import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canValidateAdv, getCurrentMember } from "@/lib/adv-permissions";

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canValidateAdv(member)) {
    return NextResponse.json({ error: "Forbidden — Admin ou Finance requis" }, { status: 403 });
  }
  const { id: dealId } = await ctx.params;
  const { data: deal } = await serviceClient
    .from("deals")
    .select("id, convention_status, contact_id, company_id")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: `Deal ${dealId} introuvable` }, { status: 404 });
  if (deal.convention_status !== "to_validate") {
    return NextResponse.json(
      { error: `Convention pas en attente (status=${deal.convention_status})` },
      { status: 409 },
    );
  }

  await serviceClient.from("deals").update({
    convention_status: null, updated_at: new Date().toISOString(),
  }).eq("id", dealId);
  try {
    await serviceClient
      .from("deal_documents")
      .delete()
      .eq("deal_id", dealId)
      .eq("document_type", "convention");
  } catch (e) {
    console.error("reject convention: cleanup deal_documents failed", e);
  }
  await serviceClient.from("activities").insert({
    type: "note",
    title: "[ADV] Convention rejetée",
    description: `Convention rejetée par la Finance (aperçu). PDF supprimé, à régénérer.`,
    contact_id: deal.contact_id,
    company_id: deal.company_id,
    team_member_id: member.id,
    created_at: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true, deal_id: dealId, message: "Convention rejetée." });
}
