import { NextResponse } from "next/server";
import { createCalendarEvent } from "@/lib/google-calendar";
import { createClient } from "@supabase/supabase-js";
import { sendSessionEmail } from "@/lib/send-email";
import { generateICS } from "@/lib/ics";
import { getParisOffset } from "@/lib/timezone";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAULINE = {
  id: "55e425cb-5041-4ea4-92c3-ce2f1dbce6a0",
  name: "Pauline BECQUERELLE",
  // RDV créés sur l'agenda "Closing Académie"
  calendarId: "d5338ed9e648d81ad3ef5fcbea38b7a91df6992ba69628c1946410039833d4a5@group.calendar.google.com",
};

export async function POST(request: Request) {
  const body = await request.json();
  const {
    date, time, firstName, lastName, email, phone, company, source, website,
    mode, // "visio" | "phone"
  } = body;

  if (!date || !time || !firstName || !lastName || !email || !phone || !company) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const offset = getParisOffset(date);
  const startDateTime = `${date}T${time}:00${offset}`;
  const [h, m] = time.split(":").map(Number);
  const endM = m + 30;
  const endH = endM >= 60 ? h + 1 : h;
  const endDateTime = `${date}T${String(endH).padStart(2, "0")}:${String(endM % 60).padStart(2, "0")}:00${offset}`;

  const locationLabel = mode === "visio" ? "Visioconférence" : "Appel téléphonique";

  // 1. Create Google Calendar event on "Closing Académie" calendar
  const { success, eventId, error: calError } = await createCalendarEvent({
    calendarId: PAULINE.calendarId,
    summary: `Bilan Commercial — ${firstName} ${lastName} (${company})`,
    description: `Prospect: ${firstName} ${lastName}\nEmail: ${email}\nTéléphone: ${phone}\nEntreprise: ${company}\nSite web: ${website || "—"}\nSource: ${source || "—"}\nMode: ${locationLabel}`,
    location: locationLabel,
    startDateTime,
    endDateTime,
  });

  if (!success) {
    return NextResponse.json({ error: calError || "Failed to create calendar event" }, { status: 500 });
  }

  // 1b. Send .ics invitation to prospect
  if (email) {
    const icsContent = generateICS({
      summary: `Bilan Commercial — ${firstName} ${lastName} (${company})`,
      description: `Rendez-vous avec La Closing Académie\nMode : ${locationLabel}`,
      location: locationLabel,
      startDateTime,
      endDateTime,
      organizerName: "La Closing Académie",
      organizerEmail: "contact@closing-academie.com",
    });
    await sendSessionEmail({
      to: email,
      subject: `Confirmation de votre rendez-vous — La Closing Académie`,
      body: [
        `Bonjour ${firstName},`,
        "",
        "Votre rendez-vous est confirmé :",
        "",
        `📆 ${date} à ${time}`,
        `🖥️ ${locationLabel}`,
        "",
        "Vous trouverez en pièce jointe une invitation calendrier (.ics) à ajouter à votre agenda.",
        "",
        "À très bientôt,",
        "",
        "L'équipe La Closing Académie",
      ].join("\n"),
      attachments: [{ filename: "invitation.ics", content: icsContent }],
    });
  }

  // 2. Find or create company
  let companyId: string | null = null;
  const { data: existingCompany } = await supabase
    .from("companies")
    .select("id")
    .ilike("name", company)
    .maybeSingle();

  if (existingCompany) {
    companyId = existingCompany.id;
  } else {
    const { data: newCompany } = await supabase
      .from("companies")
      .insert({ name: company, lifecycle_stage: "lead", website: website || null })
      .select("id")
      .single();
    companyId = newCompany?.id ?? null;
  }

  // 3. Find or create contact (Inbound)
  let contact: { id: string } | null = null;
  const { data: existingContact } = await supabase
    .from("contacts")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (existingContact) {
    await supabase.from("contacts").update({
      phone,
      company_id: companyId,
      lead_status: "booked",
      notes: source ? `Source: ${source}` : null,
    }).eq("id", existingContact.id);
    contact = existingContact;
  } else {
    const { data: newContact } = await supabase
      .from("contacts")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        company_id: companyId,
        contact_type: "inbound",
        lifecycle_stage: "lead",
        lead_status: "booked",
        owner_id: PAULINE.id,
        notes: source ? `Source: ${source}` : null,
      })
      .select("id")
      .single();
    contact = newContact;
  }

  // 4. Create meeting in CRM
  if (contact) {
    await supabase.from("meetings").insert({
      contact_id: contact.id,
      company_id: companyId,
      assigned_to: PAULINE.id,
      meeting_type: "R1",
      status: "booked",
      scheduled_at: startDateTime,
      duration_minutes: 30,
      meeting_mode: mode === "visio" ? "visio" : "phone",
      notes: `Réservé via la landing page booking Pauline.\nSource: ${source || "—"}\nSite web: ${website || "—"}`,
    });
  }

  return NextResponse.json({
    success: true,
    eventId,
    contactId: contact?.id,
    assignedName: PAULINE.name,
  });
}
