// src/app/api/deals/[id]/quote/validate/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canValidateAdv, getCurrentMember } from "@/lib/adv-permissions";
import { sendValidatedQuote } from "@/lib/adv-quote-runner";

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
  const result = await sendValidatedQuote({ serviceClient, dealId, teamMemberId: member.id });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({
    ok: true, deal_id: dealId, signing_link: result.signingLink,
    message: "Devis validé et envoyé en signature au client.",
  });
}
