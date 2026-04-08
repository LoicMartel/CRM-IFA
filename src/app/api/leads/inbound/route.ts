import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSessionEmail } from "@/lib/send-email";

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

    // 1. Find or create company from website URL
    let companyId: string | null = null;
    if (website) {
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
            lifecycle_stage: "lead",
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

    if (existingContact) {
      // Update existing contact
      await supabase.from("contacts").update({
        phone: phone || undefined,
        company_id: companyId || undefined,
        lifecycle_stage: "lead_marketing",
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
          source_id: source === "embed-form" || source === "embed-form-book" ? "3e404a7f-c1b5-4d71-8dcd-2fa54aba0585" : null,
          notes: `Source: ${source || "Landing Page"}\nType: ${clientType || "—"}\nSite web: ${website || "—"}`,
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
      `📣 Source : Landing Page (Publicité)`,
      "",
      `Le contact a été créé automatiquement dans le CRM avec le statut "Lead Marketing".`,
      "",
      `👉 https://crm-lca.vercel.app/contacts/${contactId}`,
    ].filter(Boolean).join("\n");

    // Send to both Pauline and Rafi in parallel
    await Promise.all([
      sendSessionEmail({
        to: "pauline-ext@closing-academie.com",
        subject: notifSubject,
        body: notifBody,
      }),
      sendSessionEmail({
        to: "rafi@closing-academie.com",
        subject: notifSubject,
        body: notifBody,
      }),
    ]);

    return NextResponse.json({ success: true, contactId }, { headers: CORS_HEADERS });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: CORS_HEADERS });
  }
}
