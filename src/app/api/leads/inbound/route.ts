import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSessionEmail } from "@/lib/send-email";
import { loadWorkflow, isStepActive } from "@/lib/automations";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Allow CORS from Webflow
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { firstName, lastName, email, phone, website, source, clientType } = body;

    if (!firstName || !lastName || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400, headers: CORS_HEADERS });
    }

    const wf = await loadWorkflow("landing-page-lead");
    if (wf && !wf.is_active) {
      return NextResponse.json({ skipped: true, reason: "workflow disabled" }, { headers: CORS_HEADERS });
    }

    // 1. Find or create company from website URL
    let companyId: string | null = null;
    if (website && isStepActive(wf, "create-update-company").active) {
      const { data: existingCompany } = await supabase
        .from("companies")
        .select("id")
        .ilike("website", `%${website}%`)
        .maybeSingle();

      if (existingCompany) {
        companyId = existingCompany.id;
      } else {
        // Extract company name from URL (remove www., .com, .fr, etc.)
        const companyName = website
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "")
          .replace(/\.[a-z]{2,}$/i, "")
          .replace(/\.[a-z]{2,}$/i, "");

        const { data: newCompany } = await supabase
          .from("companies")
          .insert({
            name: companyName,
            website,
            lifecycle_stage: "prospect",
          })
          .select("id")
          .single();
        companyId = newCompany?.id ?? null;
      }
    }

    // 2. Find or create contact
    let contactId: string | null = null;
    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    const resolvedSourceId = source === "embed-form"
      ? "59ab5fc4-e4f6-43c4-b327-61a90001ae16"   // Meta ads - tunnel commercial
      : source === "embed-form-book"
      ? "15e8fa54-6540-43e5-902a-3231e1522e44"    // Meta ads - tunnel book
      : null;

    if (existingContact) {
      // Update existing contact
      await supabase.from("contacts").update({
        phone: phone || undefined,
        company_id: companyId || undefined,
        lifecycle_stage: "lead_marketing",
        ...(resolvedSourceId ? { source_id: resolvedSourceId } : {}),
      }).eq("id", existingContact.id);
      contactId = existingContact.id;
    } else {
      const { data: newContact } = await supabase
        .from("contacts")
        .insert({
          first_name: firstName,
          last_name: lastName,
          email,
          phone: phone || null,
          company_id: companyId,
          contact_type: clientType === "entreprise" ? "outbound" : "inbound",
          lifecycle_stage: "lead_marketing",
          lead_status: "lead",
          source_id: resolvedSourceId,
          notes: `Source: ${source === "embed-form" ? "Meta ads - tunnel commercial" : source === "embed-form-book" ? "Meta ads - tunnel book" : source || "Landing Page"}\nType: ${clientType || "—"}\nSite web: ${website || "—"}`,
        })
        .select("id")
        .single();
      contactId = newContact?.id ?? null;
    }

    // 3. Send email notification to Pauline and Rafi
    const notifSubject = `Nouveau lead marketing — ${firstName} ${lastName}`;
    const notifBody = [
      `Un nouveau lead vient d'arriver via la landing page :`,
      "",
      `👤 ${firstName} ${lastName}`,
      `✉️ ${email}`,
      phone ? `📞 ${phone}` : "",
      website ? `🌐 ${website}` : "",
      `📣 Source : ${source === "embed-form" ? "Meta ads - tunnel commercial" : source === "embed-form-book" ? "Meta ads - tunnel book" : "Landing Page (Publicité)"}`,
      "",
      `Le contact a été créé automatiquement dans le CRM avec le statut "Lead Marketing".`,
      "",
      `👉 https://crm-lca.vercel.app/contacts/${contactId}`,
    ].filter(Boolean).join("\n");

    // Send to Pauline and Rafi (each individually toggleable)
    const emailPromises: Promise<any>[] = [];
    if (isStepActive(wf, "notify-pauline").active) {
      emailPromises.push(sendSessionEmail({
        to: "pauline-ext@closing-academie.com",
        subject: notifSubject,
        body: notifBody,
      }));
    }
    if (isStepActive(wf, "notify-rafi").active) {
      emailPromises.push(sendSessionEmail({
        to: "rafi@closing-academie.com",
        subject: notifSubject,
        body: notifBody,
      }));
    }
    if (emailPromises.length > 0) await Promise.all(emailPromises);

    // 4. Send thank-you email with book PDF for book-related sources
    if ((source === "landing-book-financement" || source === "embed-form-book") && email && isStepActive(wf, "send-book-pdf").active) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://crm-lca.vercel.app";
        const pdfRes = await fetch(`${baseUrl}/book-financement-gratuit.pdf`);
        const pdfBuffer = await pdfRes.arrayBuffer();
        const pdfContent = Buffer.from(pdfBuffer);

        await sendSessionEmail({
          to: email,
          subject: "Votre Book Financements 2026 est prêt !",
          body: [
            `Bonjour ${firstName},`,
            "",
            "Merci pour votre intérêt ! Votre Book Financements édition 2026 est disponible en pièce jointe.",
            "",
            "Dans ce guide, vous découvrirez :",
            "",
            "• Comment intégrer les financements dans votre discours commercial",
            "• Comment identifier les bons dispositifs selon vos prospects",
            "• Comment transformer un « je n'ai pas le budget » en solution",
            "• Un premier dispositif détaillé : le PDC OPCO",
            "",
            "Ce book a été conçu pour les dirigeants d'organismes de formation et les responsables commerciaux qui souhaitent aider leurs clients à s'offrir leurs formations.",
            "",
            "Pour aller plus loin et accéder à la version complète avec tous les dispositifs (OPCO, FAF, CPF, France Travail...), une méthode claire et une stratégie commerciale fondée sur les financements :",
            "https://buy.stripe.com/bJedR8dso89x6vd2MqfYY07",
            "",
            "Si vous avez la moindre question, n'hésitez pas à nous répondre directement.",
            "",
            "À très bientôt,",
            "",
            "L'équipe La Closing Académie",
          ].join("\n"),
          attachments: [{ filename: "Book-Financements-2026.pdf", content: pdfContent, contentType: "application/pdf" }],
        });
      } catch {
        // Email is best-effort, don't block the response
      }
    }

    return NextResponse.json({ success: true, contactId }, { headers: CORS_HEADERS });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: CORS_HEADERS });
  }
}
