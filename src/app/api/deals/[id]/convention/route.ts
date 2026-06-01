import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canInvoice, getCurrentMember } from "@/lib/adv-permissions";
import { prepareConvention, AdvConventionError, type ConventionFormInput } from "@/lib/adv-convention";

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canInvoice(member)) {
    return NextResponse.json({ error: "Forbidden — Admin ou Finance requis" }, { status: 403 });
  }

  const { id: dealId } = await ctx.params;
  let form: ConventionFormInput;
  try {
    form = (await req.json()) as ConventionFormInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!form.intitule?.trim()) {
    return NextResponse.json({ error: "Intitulé de la formation requis" }, { status: 400 });
  }

  const { data: deal, error: dealErr } = await serviceClient
    .from("deals")
    .select("id, name, amount, contact_id, company_id, convention_signed_at")
    .eq("id", dealId)
    .maybeSingle();
  if (dealErr) return NextResponse.json({ error: dealErr.message }, { status: 500 });
  if (!deal) return NextResponse.json({ error: `Deal ${dealId} introuvable` }, { status: 404 });
  if (deal.convention_signed_at) {
    return NextResponse.json(
      { error: "Convention déjà signée — régénération bloquée." },
      { status: 409 },
    );
  }

  const { data: contact } = await serviceClient
    .from("contacts").select("first_name, last_name, email").eq("id", deal.contact_id).maybeSingle();
  const { data: company } = await serviceClient
    .from("companies").select("name, address, city").eq("id", deal.company_id).maybeSingle();
  if (!contact || !company) {
    return NextResponse.json({ error: "Contact ou entreprise introuvable sur le deal" }, { status: 422 });
  }

  try {
    const { pdf } = await prepareConvention({
      deal: { id: deal.id, name: deal.name, amount: deal.amount },
      company,
      contact,
      form,
    });

    // Stockage PDF (deal_documents)
    let stored = false;
    try {
      const filename = `Convention_${deal.id}.pdf`;
      const storagePath = `${deal.id}/${filename}`;
      await serviceClient.storage
        .from("deal-documents")
        .upload(storagePath, pdf, { contentType: "application/pdf", upsert: true });
      await serviceClient.from("deal_documents").insert({
        deal_id: deal.id,
        name: filename,
        file_path: storagePath,
        file_size: pdf.length,
        file_type: "application/pdf",
        document_type: "convention",
      });
      stored = true;
    } catch (docErr) {
      console.error("Convention PDF -> deal_documents failed:", docErr);
    }
    if (!stored) {
      return NextResponse.json({ error: "Échec stockage du PDF de convention" }, { status: 502 });
    }

    await serviceClient.from("deals").update({
      convention_status: "to_validate", updated_at: new Date().toISOString(),
    }).eq("id", deal.id);

    await serviceClient.from("activities").insert({
      type: "note",
      title: "[ADV] Convention préparée — à valider",
      description: `Convention de formation générée (Carbone) et en attente de validation pour "${deal.name ?? deal.id}".`,
      contact_id: deal.contact_id,
      company_id: deal.company_id,
      team_member_id: member.id,
      created_at: new Date().toISOString(),
    });

    const { notifyPieceToValidate } = await import("@/lib/adv-notify");
    await notifyPieceToValidate(serviceClient, { type: "convention", label: deal.name ?? deal.id, dealId: deal.id });

    return NextResponse.json({
      ok: true,
      deal_id: deal.id,
      message: "Convention préparée — à valider dans « Pièces à valider » avant envoi.",
    });
  } catch (err) {
    const message = err instanceof AdvConventionError || err instanceof Error ? err.message : String(err);
    await serviceClient.from("activities").insert({
      type: "note",
      title: "[ADV] Échec convention",
      description: `Erreur génération convention : ${message}`,
      contact_id: deal.contact_id,
      company_id: deal.company_id,
      team_member_id: member.id,
      created_at: new Date().toISOString(),
    });
    return NextResponse.json({ error: `Convention échouée : ${message}` }, { status: 502 });
  }
}
