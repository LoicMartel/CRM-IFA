import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getParisOffset } from "@/lib/timezone";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MEMBERS: Record<string, string> = {
  "93469203-fa59-4ffb-8877-7486a82addab": "Rafi MOUHAMAD",
  "9bcd91e5-0c11-44ba-9bc8-1de4bad9c040": "Naznine MOUHAMAD",
};

export async function POST(request: Request) {
  const body = await request.json();
  const {
    date,
    time,
    assignedTo,
    firstName,
    lastName,
    email,
    phone,
    company,
    source,
    website,
    mode, // "visio" | "phone"
  } = body;

  if (!date || !time || !assignedTo || !firstName || !lastName || !email || !phone || !company) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const memberName = MEMBERS[assignedTo];
  if (!memberName) {
    return NextResponse.json({ error: "Invalid assigned member" }, { status: 400 });
  }

  const offset = getParisOffset(date);
  const startDateTime = `${date}T${time}:00${offset}`;

  // 1. Find or create company
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

  // 2. Find or create contact
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
        owner_id: assignedTo,
        notes: source ? `Source: ${source}` : null,
      })
      .select("id")
      .single();
    contact = newContact;
  }

  // 3. Create meeting in CRM
  let meetingId: string | null = null;
  if (contact) {
    const { data: newMeeting } = await supabase.from("meetings").insert({
      contact_id: contact.id,
      company_id: companyId,
      assigned_to: assignedTo,
      meeting_type: "R1",
      status: "booked",
      scheduled_at: startDateTime,
      duration_minutes: 30,
      meeting_mode: mode === "visio" ? "visio" : "phone",
      notes: `Réservé via la landing page booking.\nSource: ${source || "—"}\nSite web: ${website || "—"}`,
    }).select("id").single();
    meetingId = newMeeting?.id ?? null;
  }

  // 4. Trigger centralized notify (calendar + prospect email + Slack/email to assignee)
  if (meetingId) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://crm-lca.vercel.app";
    await fetch(`${baseUrl}/api/meetings/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId }),
    });
  }

  return NextResponse.json({
    success: true,
    contactId: contact?.id,
    meetingId,
    assignedName: memberName,
  });
}
