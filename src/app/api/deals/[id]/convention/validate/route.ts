import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canValidateAdv, getCurrentMember } from "@/lib/adv-permissions";
import { sendConventionSignature, AdvConventionError } from "@/lib/adv-convention";
import { resolveBeneficiary } from "@/lib/adv-raison-sociale";

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
    .select("id, name, convention_status, convention_signed_at, contact_id, company_id, raison_sociale_id")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: `Deal ${dealId} introuvable` }, { status: 404 });
  if (deal.convention_signed_at) {
    return NextResponse.json({ error: "Convention déjà signée." }, { status: 409 });
  }
  if (deal.convention_status !== "to_validate") {
    return NextResponse.json(
      { error: `Convention pas en attente (status=${deal.convention_status})` },
      { status: 409 },
    );
  }

  const { data: contact } = await serviceClient
    .from("contacts")
    .select("first_name, last_name, email")
    .eq("id", deal.contact_id)
    .maybeSingle();
  // Le document de signature porte le nom de l'entité retenue à la préparation.
  const beneficiary = await resolveBeneficiary(serviceClient, deal.company_id, deal.raison_sociale_id);
  if (!contact) return NextResponse.json({ error: "Contact introuvable" }, { status: 422 });

  const { data: doc } = await serviceClient
    .from("deal_documents")
    .select("file_path")
    .eq("deal_id", dealId)
    .eq("document_type", "convention")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!doc?.file_path) {
    return NextResponse.json({ error: "PDF de convention introuvable" }, { status: 422 });
  }
  const { data: signed } = await serviceClient.storage
    .from("deal-documents")
    .createSignedUrl(doc.file_path, 600);
  if (!signed?.signedUrl) {
    return NextResponse.json({ error: "URL signée du PDF indisponible" }, { status: 502 });
  }

  try {
    const pdfRes = await fetch(signed.signedUrl);
    if (!pdfRes.ok) {
      return NextResponse.json({ error: `Téléchargement du PDF convention échoué (${pdfRes.status})` }, { status: 502 });
    }
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    const magic = pdfBuffer.subarray(0, 5).toString("ascii");
    if (!magic.startsWith("%PDF-")) {
      return NextResponse.json({ error: `PDF convention invalide (magic="${magic}")` }, { status: 502 });
    }
    const r = await sendConventionSignature({
      companyName: beneficiary?.name ?? null,
      contact,
      pdfBase64: pdfBuffer.toString("base64"),
    });
    await serviceClient.from("deals").update({
      convention_status: "sent",
      firma_convention_signing_id: r.signingRequestId,
      updated_at: new Date().toISOString(),
    }).eq("id", dealId);
    await serviceClient.from("activities").insert({
      type: "note",
      title: "[ADV] Convention validée et envoyée",
      description: `Convention validée par la Finance et envoyée en signature (Firma).`,
      contact_id: deal.contact_id,
      company_id: deal.company_id,
      team_member_id: member.id,
      created_at: new Date().toISOString(),
    });
    return NextResponse.json({
      ok: true,
      deal_id: dealId,
      signing_link: r.signingLink,
      message: "Convention validée et envoyée en signature.",
    });
  } catch (err) {
    const message = err instanceof AdvConventionError || err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Envoi convention échoué : ${message}` }, { status: 502 });
  }
}
