import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { sendSessionEmail } from "@/lib/send-email";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-03-25.dahlia",
  });
}

// Service role client for server-side operations
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const NOTIFY_EMAILS = [
  "rafi@closing-academie.com",
  "alexandre@closing-academie.com",
  "loic@closing-academie.com",
  "naznine@closing-academie.com",
];

export async function POST(req: NextRequest) {
  // 1. Verify Stripe signature
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // 2. Handle checkout.session.completed
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const customerEmail = session.customer_details?.email ?? session.customer_email;
    const customerName = session.customer_details?.name ?? "Inconnu";
    const amountTotal = (session.amount_total ?? 0) / 100; // Stripe amounts are in cents

    console.log(`Stripe payment received: ${customerName} (${customerEmail}) — ${amountTotal}€`);

    const supabase = getSupabase();

    // 3. Find or create contact by email
    let contactId: string | null = null;
    let contactName = customerName;

    if (customerEmail) {
      const { data: existingContact } = await supabase
        .from("contacts")
        .select("id, first_name, last_name")
        .eq("email", customerEmail)
        .limit(1)
        .single();

      if (existingContact) {
        contactId = existingContact.id;
        contactName = `${existingContact.first_name} ${existingContact.last_name}`;
      } else {
        // Create a new contact from Stripe data
        const nameParts = customerName.split(" ");
        const firstName = nameParts[0] || "Inconnu";
        const lastName = nameParts.slice(1).join(" ") || "";

        const { data: newContact } = await supabase
          .from("contacts")
          .insert({
            first_name: firstName,
            last_name: lastName,
            email: customerEmail,
            phone: session.customer_details?.phone ?? null,
            is_client: true,
            lifecycle_stage: "customer",
          })
          .select("id")
          .single();

        if (newContact) {
          contactId = newContact.id;
        }
      }
    }

    // 4. Create deal
    const dealName = `Book financement Stripe - ${contactName}`;
    const today = new Date().toISOString().split("T")[0];

    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .insert({
        name: dealName,
        contact_id: contactId,
        stage: "closed_won",
        amount: amountTotal,
        probability: 100,
        close_date: today,
        notes: `Paiement Stripe automatique\nSession ID: ${session.id}\nEmail: ${customerEmail}\nMontant: ${amountTotal}€`,
      })
      .select("id")
      .single();

    if (dealError) {
      console.error("Error creating deal:", dealError);
    }

    // 5. Send notification emails
    const emailBody = `
<h2 style="color: #2e7d32;">💰 Nouveau paiement Stripe reçu !</h2>

<table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
  <tr>
    <td style="padding: 8px 16px; background: #f0f4f8; font-weight: 600; width: 140px;">Prospect</td>
    <td style="padding: 8px 16px;">${contactName}</td>
  </tr>
  <tr>
    <td style="padding: 8px 16px; background: #f0f4f8; font-weight: 600;">Email</td>
    <td style="padding: 8px 16px;">${customerEmail ?? "Non renseigné"}</td>
  </tr>
  <tr>
    <td style="padding: 8px 16px; background: #f0f4f8; font-weight: 600;">Montant</td>
    <td style="padding: 8px 16px; color: #2e7d32; font-weight: 700; font-size: 18px;">${amountTotal.toLocaleString("fr-FR")} €</td>
  </tr>
  <tr>
    <td style="padding: 8px 16px; background: #f0f4f8; font-weight: 600;">Deal créé</td>
    <td style="padding: 8px 16px;">${dealName}</td>
  </tr>
</table>

<p>Le deal a été automatiquement créé dans le pipeline en statut <strong>Gagné</strong>.</p>
`;

    for (const email of NOTIFY_EMAILS) {
      await sendSessionEmail({
        to: email,
        subject: `💰 Paiement Stripe : ${contactName} — ${amountTotal.toLocaleString("fr-FR")} €`,
        body: emailBody,
      });
    }

    // In-app notifications for all active team members
    const { data: members } = await supabase
      .from("team_members")
      .select("id, email")
      .eq("is_active", true)
      .in("email", NOTIFY_EMAILS);
    if (members && members.length > 0) {
      const notifRows = members.map((m: any) => ({
        recipient_id: m.id,
        type: "stripe_payment",
        title: `💰 Paiement Stripe : ${amountTotal.toLocaleString("fr-FR")} €`,
        body: `${contactName} — ${dealName}`,
        link_url: contactId ? `/contacts/${contactId}` : "/sales",
        related_entity_type: "deal",
      }));
      await supabase.from("notifications").insert(notifRows);
    }

    console.log(`Deal "${dealName}" created, notifications sent to ${NOTIFY_EMAILS.length} recipients`);
  }

  // Return 200 to acknowledge receipt
  return NextResponse.json({ received: true });
}
