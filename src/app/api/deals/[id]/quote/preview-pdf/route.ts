// Aperçu PDF d'un devis V2 : convertit le .docx courant en PDF à la volée (Carbone)
// pour affichage inline dans la trust gate (le .docx reste la source éditable).
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canCreateQuote, canValidateAdv, getCurrentMember } from "@/lib/adv-permissions";
import { convertDocxToPdf } from "@/lib/carbone-client";

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
  if (!deal) return NextResponse.json({ error: "Deal introuvable" }, { status: 404 });
  if (!canCreateQuote(member, deal) && !canValidateAdv(member)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: doc } = await serviceClient
    .from("deal_documents").select("file_path")
    .eq("deal_id", dealId).eq("document_type", "devis")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!doc?.file_path) return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });

  try {
    const { data: dl } = await serviceClient.storage.from("deal-documents").download(doc.file_path);
    if (!dl) return NextResponse.json({ error: "Téléchargement du .docx échoué" }, { status: 502 });
    const pdf = await convertDocxToPdf(Buffer.from(await dl.arrayBuffer()));
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=\"devis-preview.pdf\"",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Conversion PDF aperçu échouée : ${message}` }, { status: 502 });
  }
}
