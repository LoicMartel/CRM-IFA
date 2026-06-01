// src/app/api/adv/pending/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canValidateAdv, getCurrentMember } from "@/lib/adv-permissions";
import { getInvoicePdfUrl } from "@/lib/adv-invoice";

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export interface PendingPiece {
  type: "devis" | "convention" | "facture";
  refId: string;          // deal.id (devis/convention) ou billing_month.id (facture)
  dealId: string | null;
  dealName: string | null;
  client: string | null;
  amount: number | null;
  trainingDays: number | null;
  generatedAt: string | null;
  pdfUrl: string | null;  // signed URL (devis/conv) ou public_file_url draft (facture) ; null si pas prêt
  pdfReady: boolean;
}

async function signedDocUrl(dealId: string, docType: string): Promise<string | null> {
  const { data: doc } = await serviceClient
    .from("deal_documents").select("file_path")
    .eq("deal_id", dealId).eq("document_type", docType)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!doc?.file_path) return null;
  const { data: signed } = await serviceClient.storage.from("deal-documents").createSignedUrl(doc.file_path, 600);
  return signed?.signedUrl ?? null;
}

export async function GET() {
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canValidateAdv(member)) return NextResponse.json({ error: "Forbidden — Admin ou Finance requis" }, { status: 403 });

  const pieces: PendingPiece[] = [];

  // Q1 — deals en attente (devis ou convention)
  const { data: deals } = await serviceClient
    .from("deals")
    .select("id, name, amount, training_days, stage, convention_status, updated_at, companies(name)")
    .or("stage.eq.quote_to_validate,convention_status.eq.to_validate");

  for (const d of deals ?? []) {
    const client = (d.companies as { name?: string } | null)?.name ?? null;
    if (d.stage === "quote_to_validate") {
      pieces.push({
        type: "devis", refId: d.id, dealId: d.id, dealName: d.name, client,
        amount: d.amount != null ? Number(d.amount) : null,
        trainingDays: d.training_days != null ? Number(d.training_days) : null,
        generatedAt: d.updated_at, pdfUrl: await signedDocUrl(d.id, "devis"), pdfReady: true,
      });
    }
    if (d.convention_status === "to_validate") {
      pieces.push({
        type: "convention", refId: d.id, dealId: d.id, dealName: d.name, client,
        amount: d.amount != null ? Number(d.amount) : null,
        trainingDays: d.training_days != null ? Number(d.training_days) : null,
        generatedAt: d.updated_at, pdfUrl: await signedDocUrl(d.id, "convention"), pdfReady: true,
      });
    }
  }

  // Q2 — billing_months a_valider (facture)
  const { data: bms } = await serviceClient
    .from("billing_months")
    .select("id, month, amount, pennylane_invoice_id, updated_at, deal_id, billing_entries(client_name, deal_id)")
    .eq("status", "a_valider");

  for (const bm of bms ?? []) {
    const entry = bm.billing_entries as { client_name?: string; deal_id?: string } | null;
    let pdfUrl: string | null = null;
    if (bm.pennylane_invoice_id) {
      try { pdfUrl = await getInvoicePdfUrl(Number(bm.pennylane_invoice_id)); } catch { pdfUrl = null; }
    }
    pieces.push({
      type: "facture", refId: bm.id, dealId: (bm.deal_id as string) ?? entry?.deal_id ?? null,
      dealName: null, client: entry?.client_name ?? null,
      amount: bm.amount != null ? Number(bm.amount) : null, trainingDays: null,
      generatedAt: bm.updated_at, pdfUrl, pdfReady: pdfUrl != null,
    });
  }

  pieces.sort((a, b) => (b.generatedAt ?? "").localeCompare(a.generatedAt ?? ""));
  return NextResponse.json({ ok: true, count: pieces.length, pieces });
}
