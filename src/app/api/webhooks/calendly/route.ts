import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { loadWorkflow, isStepActive } from "@/lib/automations";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const CALENDLY_SIGNING_KEY = process.env.CALENDLY_WEBHOOK_SIGNING_KEY ?? "";

/**
 * Vérifie la signature Calendly (header `Calendly-Webhook-Signature: t=..,v1=..`).
 * HMAC-SHA256 de `${t}.${rawBody}`. Comparaison timing-safe.
 * Fail-closed : sans signing key configurée, on rejette (⚠️ configurer
 * CALENDLY_WEBHOOK_SIGNING_KEY avant merge sinon le webhook casse).
 */
function verifyCalendlySignature(rawBody: string, header: string | null): boolean {
  if (!CALENDLY_SIGNING_KEY || !header) return false;
  const parts: Record<string, string> = {};
  for (const kv of header.split(",")) {
    const [k, v] = kv.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  const { t, v1 } = parts;
  if (!t || !v1) return false;
  const expected = crypto
    .createHmac("sha256", CALENDLY_SIGNING_KEY)
    .update(`${t}.${rawBody}`)
    .digest("hex");
  const a = Buffer.from(v1);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (!verifyCalendlySignature(rawBody, req.headers.get("calendly-webhook-signature"))) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    const body = JSON.parse(rawBody);

    // Calendly webhook payload
    const event = body.event; // "invitee.created" or "invitee.canceled"
    const payload = body.payload;

    if (event !== "invitee.created") {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const wf = await loadWorkflow("calendly-webhook");
    if (wf && !wf.is_active) {
      return NextResponse.json({ skipped: true, reason: "workflow disabled" });
    }

    // Extract invitee info
    const inviteeEmail = payload?.email ?? payload?.invitee?.email ?? "";
    const inviteeName = payload?.name ?? payload?.invitee?.name ?? "";
    const scheduledAt = payload?.event?.start_time ?? payload?.scheduled_event?.start_time ?? "";
    const endTime = payload?.event?.end_time ?? payload?.scheduled_event?.end_time ?? "";

    // Extract from questions_and_answers if available
    let phone = "";
    let company = "";
    const qna = payload?.questions_and_answers ?? payload?.invitee?.questions_and_answers ?? [];
    for (const q of qna) {
      const question = (q.question ?? "").toLowerCase();
      const answer = q.answer ?? "";
      if (question.includes("phone") || question.includes("téléphone") || question.includes("tel")) {
        phone = answer;
      }
      if (question.includes("entreprise") || question.includes("société") || question.includes("company")) {
        company = answer;
      }
    }

    if (!inviteeEmail) {
      return NextResponse.json({ error: "No email" }, { status: 400 });
    }

    // Find existing contact by email
    if (!isStepActive(wf, "create-update-contact").active) {
      return NextResponse.json({ ok: true, skipped: "contact step disabled" });
    }
    const { data: contact } = await supabase
      .from("contacts")
      .select("id, company_id")
      .eq("email", inviteeEmail.toLowerCase().trim())
      .maybeSingle();

    let contactId = contact?.id;
    let companyId = contact?.company_id;

    if (!contactId) {
      // Contact doesn't exist yet - create it
      const nameParts = inviteeName.split(" ");
      const firstName = nameParts[0] ?? "";
      const lastName = nameParts.slice(1).join(" ") ?? "";

      const { data: newContact } = await supabase.from("contacts").insert({
        first_name: firstName,
        last_name: lastName,
        email: inviteeEmail.toLowerCase().trim(),
        phone: phone || null,
        lifecycle_stage: "prospect",
        lead_status: "booked",
        contact_type: "inbound",
        was_lead_marketing: true,
      }).select("id").single();

      contactId = newContact?.id;
    } else {
      // Update existing contact status to booked
      await supabase.from("contacts").update({
        lead_status: "booked",
        lifecycle_stage: "prospect",
        phone: phone || undefined,
      }).eq("id", contactId);
    }

    if (!contactId) {
      return NextResponse.json({ error: "Could not find or create contact" }, { status: 500 });
    }

    // Calculate duration
    let durationMinutes = 30;
    if (scheduledAt && endTime) {
      durationMinutes = Math.round((new Date(endTime).getTime() - new Date(scheduledAt).getTime()) / 60000);
    }

    // Create R0 qualification meeting
    if (!isStepActive(wf, "create-meeting").active) {
      return NextResponse.json({ ok: true, contact_id: contactId, meeting: "step disabled" });
    }
    await supabase.from("meetings").insert({
      meeting_type: "R0",
      status: "booked",
      contact_id: contactId,
      company_id: companyId || null,
      scheduled_at: scheduledAt || new Date().toISOString(),
      duration_minutes: durationMinutes,
      meeting_mode: "visio",
      notes: `RDV pris via Calendly${company ? ` - Entreprise : ${company}` : ""}`,
    });

    return NextResponse.json({ ok: true, contact_id: contactId, meeting: "created" });
  } catch (err) {
    console.error("Calendly webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
