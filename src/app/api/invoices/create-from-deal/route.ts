import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canInvoice, getCurrentMember } from "@/lib/adv-permissions";
import { triggerN8nWebhook } from "@/lib/n8n-client";
import { generateDealInvoice, AdvInvoiceError } from "@/lib/adv-invoice";

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const ALLOWED_STAGES = ["quote_signed", "opco_deposit", "closed_won"] as const;

// Kill switch : true => ancien proxy n8n (rollback instant), false => intra-CRM.
const USE_N8N_FALLBACK = process.env.USE_N8N_FALLBACK === "true";

export async function POST(req: Request) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canInvoice(member)) {
    return NextResponse.json(
      { error: "Forbidden — seul un Admin ou un membre Finance peut déclencher une facturation" },
      { status: 403 },
    );
  }

  let body: { deal_id?: string; invoice_amount?: number; label?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const dealId = body.deal_id?.trim();
  if (!dealId) {
    return NextResponse.json({ error: "deal_id manquant" }, { status: 400 });
  }

  if (body.invoice_amount !== undefined && (typeof body.invoice_amount !== "number" || body.invoice_amount <= 0)) {
    return NextResponse.json(
      { error: "invoice_amount doit être un nombre positif si fourni" },
      { status: 400 },
    );
  }

  const { data: deal, error: dealErr } = await serviceClient
    .from("deals")
    .select("id, name, stage, amount, owner_id, contact_id, company_id, pennylane_quote_id, pennylane_invoice_id, is_invoiced")
    .eq("id", dealId)
    .maybeSingle();

  if (dealErr) {
    return NextResponse.json({ error: dealErr.message }, { status: 500 });
  }
  if (!deal) {
    return NextResponse.json({ error: `Deal ${dealId} introuvable` }, { status: 404 });
  }

  if (!ALLOWED_STAGES.includes(deal.stage as typeof ALLOWED_STAGES[number])) {
    return NextResponse.json(
      {
        error: `Stage "${deal.stage}" non éligible (attendu: ${ALLOWED_STAGES.join(", ")})`,
        deal_stage: deal.stage,
      },
      { status: 409 },
    );
  }

  if (deal.is_invoiced && deal.pennylane_invoice_id) {
    return NextResponse.json(
      {
        error: "Ce deal a déjà une invoice Pennylane émise. Pour une nouvelle invoice (échéance OPCO), passer par la V2 convention.",
        pennylane_invoice_id: deal.pennylane_invoice_id,
      },
      { status: 409 },
    );
  }

  // --- Chemin legacy : proxy n8n (kill switch) ---
  if (USE_N8N_FALLBACK) {
    const payload: Record<string, unknown> = { deal_id: deal.id };
    if (body.invoice_amount !== undefined) payload.invoice_amount = body.invoice_amount;
    if (body.label) payload.label = body.label;

    const result = await triggerN8nWebhook("invoice-from-deal", payload);
    if (!result.ok) {
      return NextResponse.json(
        { error: `n8n trigger failed: ${result.error}`, status: result.status },
        { status: 502 },
      );
    }
    const amountStr = body.invoice_amount !== undefined ? `${body.invoice_amount} €` : `${deal.amount ?? "?"} € (total deal)`;
    await serviceClient.from("activities").insert({
      type: "note",
      title: "[ADV] Facturation Pennylane déclenchée (n8n)",
      description: `Facturation via bouton CRM (deal "${deal.name ?? deal.id}", ${amountStr}). Workflow n8n WF-005 branche A.`,
      contact_id: deal.contact_id,
      company_id: deal.company_id,
      team_member_id: member.id,
      created_at: new Date().toISOString(),
    });
    return NextResponse.json({
      ok: true,
      deal_id: deal.id,
      message: "Facturation Pennylane en cours via n8n.",
    });
  }

  // --- Chemin intra-CRM : Pennylane direct ---
  const { data: contact } = await serviceClient
    .from("contacts")
    .select("first_name, last_name, email, phone")
    .eq("id", deal.contact_id)
    .maybeSingle();

  const { data: company } = await serviceClient
    .from("companies")
    .select("id, name, siret, address, city, country")
    .eq("id", deal.company_id)
    .maybeSingle();

  if (!contact || !company) {
    return NextResponse.json(
      { error: "Contact ou entreprise introuvable sur le deal" },
      { status: 422 },
    );
  }

  try {
    const result = await generateDealInvoice({
      deal: {
        id: deal.id,
        name: deal.name,
        // override optionnel du montant facturé (sinon montant total du deal)
        amount: body.invoice_amount ?? deal.amount,
        training_days: (deal as { training_days?: number | string | null }).training_days ?? null,
        notes: null,
      },
      contact,
      company,
    });

    await serviceClient
      .from("deals")
      .update({
        pennylane_invoice_id: String(result.pennylaneInvoiceId),
        is_invoiced: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", deal.id);

    await serviceClient.from("activities").insert({
      type: "note",
      title: "[ADV] Facture créée",
      description: `Facture ${result.invoiceNumber ?? result.pennylaneInvoiceId} créée (Pennylane) pour le deal "${deal.name ?? deal.id}".${result.emailSent ? " Email envoyé au client." : " ⚠️ Email pas encore envoyé (PDF en génération) — le cron réessaiera."}`,
      contact_id: deal.contact_id,
      company_id: deal.company_id,
      team_member_id: member.id,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      deal_id: deal.id,
      pennylane_invoice_id: result.pennylaneInvoiceId,
      invoice_number: result.invoiceNumber,
      email_sent: result.emailSent,
      message: result.emailSent
        ? "Facture créée et envoyée au client."
        : "Facture créée. L'email partira dès que le PDF est généré (retry automatique).",
    });
  } catch (err) {
    const message = err instanceof AdvInvoiceError || err instanceof Error ? err.message : String(err);
    await serviceClient.from("activities").insert({
      type: "note",
      title: "[ADV] Échec facturation",
      description: `Erreur génération facture intra-CRM : ${message}`,
      contact_id: deal.contact_id,
      company_id: deal.company_id,
      team_member_id: member.id,
      created_at: new Date().toISOString(),
    });
    return NextResponse.json({ error: `Facturation échouée : ${message}` }, { status: 502 });
  }
}
