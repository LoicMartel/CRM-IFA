// src/app/api/deals/[id]/quote/replace-docx/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canCreateQuote, getCurrentMember } from "@/lib/adv-permissions";

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const EDITABLE_STAGES = ["opportunities", "quote_to_send", "quote_to_validate"];
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: dealId } = await ctx.params;

  const { data: deal } = await serviceClient
    .from("deals").select("id, stage, owner_id, quote_number").eq("id", dealId).maybeSingle();
  if (!deal) return NextResponse.json({ error: "Deal introuvable" }, { status: 404 });
  if (!canCreateQuote(member, deal)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!EDITABLE_STAGES.includes(deal.stage as string)) {
    return NextResponse.json({ error: `Devis non éditable (stage=${deal.stage})` }, { status: 409 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Fichier .docx manquant" }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".docx")) return NextResponse.json({ error: "Format .docx requis" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Fichier trop volumineux (>10 Mo)" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  // Remplace la pièce devis existante (un seul .docx devis courant).
  const { data: oldDocs } = await serviceClient.from("deal_documents")
    .select("id, file_path").eq("deal_id", dealId).eq("document_type", "devis");
  if (oldDocs?.length) {
    await serviceClient.storage.from("deal-documents").remove(oldDocs.map((d) => d.file_path));
    await serviceClient.from("deal_documents").delete().in("id", oldDocs.map((d) => d.id));
  }
  const filename = `Devis_${deal.quote_number ?? dealId}.docx`;
  const storagePath = `${dealId}/${filename}`;
  await serviceClient.storage.from("deal-documents").upload(storagePath, buffer, { contentType: DOCX_MIME, upsert: true });
  await serviceClient.from("deal_documents").insert({
    deal_id: dealId, name: filename, file_path: storagePath,
    file_size: buffer.length, file_type: DOCX_MIME, document_type: "devis",
  });

  return NextResponse.json({ ok: true, message: "Devis Word remplacé." });
}
