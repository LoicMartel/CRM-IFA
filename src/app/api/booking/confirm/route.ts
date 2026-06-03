import { NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getParisOffset } from "@/lib/timezone";
import { loadWorkflow, isStepActive } from "@/lib/automations";
import { processMeetingNotifications } from "@/lib/process-meeting-notifications";

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

  // Check automation config
  const wf = await loadWorkflow("booking-generic");
  if (wf && !wf.is_active) {
    return NextResponse.json({ skipped: true, reason: "workflow disabled" });
  }

  const offset = getParisOffset(date);
  const startDateTime = `${date}T${time}:00${offset}`;

  // 1. Find or create company
  let companyId: string | null = null;
  if (isStepActive(wf, "create-update-company").active) {
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
        .insert({ name: company, lifecycle_stage: "prospect", website: website || null })
        .select("id")
        .single();
      companyId = newCompany?.id ?? null;
    }
  }

  // 2. Find or create contact
  let contact: { id: string } | null = null;
  if (isStepActive(wf, "create-update-contact").active) {
    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    if (existingContact) {
      await supabase.from("contacts").update({
        first_name: firstName,
        last_name: lastName,
        phone,
        company_id: companyId,
        lead_status: "booked",
        lifecycle_stage: "prospect",
        owner_id: assignedTo,
        notes: source ? `Source: ${source}` : null,
      }).eq("id", existingContact.id);
      contact = existingContact;
    } else {
      const { data: newContact, error: contactError } = await supabase
        .from("contacts")
        .insert({
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          company_id: companyId,
          contact_type: "inbound",
          lifecycle_stage: "prospect",
          lead_status: "booked",
          owner_id: assignedTo,
          notes: source ? `Source: ${source}` : null,
        })
        .select("id")
        .single();
      if (contactError) {
        return NextResponse.json({ error: "Contact creation failed", detail: contactError.message }, { status: 500 });
      }
      contact = newContact;
    }
  }

  // 3. Create meeting in CRM
  let meetingId: string | null = null;
  if (contact && isStepActive(wf, "create-meeting").active) {
    const { data: newMeeting, error: meetingError } = await supabase.from("meetings").insert({
      contact_id: contact.id,
      company_id: companyId,
      assigned_to: assignedTo,
      meeting_type: "R0",
      status: "booked",
      scheduled_at: startDateTime,
      duration_minutes: 30,
      meeting_mode: mode === "visio" ? "visio" : "phone",
      notes: `Réservé via la booking page.\nSource: ${source || "—"}\nSite web: ${website || "—"}`,
    }).select("id").single();
    if (meetingError) {
      return NextResponse.json({ error: "Meeting creation failed", detail: meetingError.message, contactId: contact.id }, { status: 500 });
    }
    meetingId = newMeeting?.id ?? null;

    // Insert junction table rows for multi-participant support
    if (newMeeting?.id) {
      await supabase.from("meeting_contacts").insert({ meeting_id: newMeeting.id, contact_id: contact.id, is_primary: true });
      if (assignedTo) await supabase.from("meeting_managers").insert({ meeting_id: newMeeting.id, team_member_id: assignedTo, is_primary: true });
    }
  }

  // 4. Trigger centralized notify (calendar + prospect email + Slack/email to assignee)
  if (meetingId && isStepActive(wf, "trigger-notifications").active) {
    const mid = meetingId;
    after(async () => {
      try {
        const result = await processMeetingNotifications({ meetingId: mid });
        if (!result.success) console.error(`[booking] notification failed for meeting ${mid}:`, result.error);
        const failures = result.results.filter(r => !["Envoye", "Ajoute"].includes(r.status));
        if (failures.length > 0) console.error(`[booking] partial failures for meeting ${mid}:`, JSON.stringify(failures));
      } catch (err) {
        console.error(`[booking] notification error for meeting ${mid}:`, err);
      }
    });
  }

  // Stop the inbound agent for this lead: a RDV was booked.
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    if (contact?.id) {
      await sb.from("conversations").update({ agent_status: "booked" })
        .eq("contact_id", contact.id).in("agent_status", ["active", "escalated", "dormant"]);
    }
  } catch (e) { console.error("[booking.confirm] mark conversation booked failed:", e); }

  return NextResponse.json({
    success: true,
    contactId: contact?.id,
    meetingId,
    assignedName: memberName,
  });
}
