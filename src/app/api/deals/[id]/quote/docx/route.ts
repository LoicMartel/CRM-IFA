// src/app/api/deals/[id]/quote/docx/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canCreateQuote, getCurrentMember } from "@/lib/adv-permissions";

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: dealId } = await ctx.params;

  const { data: deal } = await serviceClient
    .from("deals").select("id, owner_id").eq("id", dealId).maybeSingle();
  if (!deal) return NextResponse.json({ error: `Deal ${dealId} introuvable` }, { status: 404 });
  if (!canCreateQuote(member, deal)) {
    return NextResponse.json({ error: "Forbidden — seul l'owner du deal ou un Admin peut télécharger le devis" }, { status: 403 });
  }

  const { data: doc } = await serviceClient
    .from("deal_documents")
    .select("file_path")
    .eq("deal_id", dealId)
    .eq("document_type", "devis")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!doc?.file_path) {
    return NextResponse.json({ error: "Aucun devis Word trouvé pour ce deal" }, { status: 404 });
  }

  const { data: signed } = await serviceClient.storage
    .from("deal-documents")
    .createSignedUrl(doc.file_path, 600);

  if (!signed?.signedUrl) {
    return NextResponse.json({ error: "Impossible de générer l'URL de téléchargement" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}
