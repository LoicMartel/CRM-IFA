import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireMember } from "@/lib/api-auth";

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const MAX_SIZE = 200 * 1024 * 1024; // 200 MB

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMember();
  if (auth instanceof NextResponse) return auth;

  const { id: dealId } = await ctx.params;

  const { data: deal } = await serviceClient
    .from("deals").select("id").eq("id", dealId).maybeSingle();
  if (!deal) return NextResponse.json({ error: "Deal introuvable" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Fichier trop volumineux (>200 Mo)" }, { status: 400 });

  const docType = (form.get("document_type") as string) || "devis";
  const buffer = Buffer.from(await file.arrayBuffer());
  // Sanitize filename: remove accents, replace spaces/special chars with underscores
  const safeName = file.name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${dealId}/${Date.now()}_${safeName}`;

  const { error: uploadError } = await serviceClient.storage
    .from("deal-documents")
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { error: insertError } = await serviceClient.from("deal_documents").insert({
    deal_id: dealId,
    name: file.name,
    file_path: storagePath,
    file_size: file.size,
    file_type: file.type,
    document_type: docType,
  });

  if (insertError) {
    await serviceClient.storage.from("deal-documents").remove([storagePath]);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
