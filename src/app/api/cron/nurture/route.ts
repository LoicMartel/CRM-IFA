import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/inbox/ingest";
import { sendEmail, unipileConfigured } from "@/lib/unipile/client";
import { logEmail } from "@/lib/send-email";

// Moteur d'envoi des séquences de nurturing + relances no-show.
// Déclenché par pg_cron (Supabase) -> GET avec `Authorization: Bearer <CRON_SECRET>`.
// Idempotent + rejouable : chaque tick n'envoie qu'UNE étape par enrôlement dû, avec claim
// atomique (met next_send_at à NULL avant l'envoi) pour éviter tout double-envoi si deux ticks
// se chevauchent. Les envois partent de la boîte de Rafi via Unipile (canal = 'email').

// Fenêtre d'envoi : 9h-19h, lundi-vendredi (heure de Paris) — cf. AC-06 des séquences WF-004.
function withinSendWindow(now: Date): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const isWeekday = !["Sat", "Sun"].includes(weekday);
  return isWeekday && hour >= 9 && hour < 19;
}

function render(text: string, ctx: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => ctx[k] ?? `{{${k}}}`);
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const isVercelCron = req.headers.get("user-agent")?.includes("vercel-cron");
  if (!isVercelCron && (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  if (!withinSendWindow(now)) {
    return NextResponse.json({ ok: true, skipped: "outside-send-window" });
  }
  // Fail-loud : sans Unipile, on n'envoie rien (pas de fallback silencieux sur Resend).
  if (!unipileConfigured()) {
    return NextResponse.json({ ok: false, error: "unipile-not-configured" });
  }

  // Liens résolus depuis l'env (contenu fourni par le client — à poser avant activation).
  const bookingLink = process.env.NURTURE_BOOKING_URL || "https://crm-lca.vercel.app/booking-general";
  const vslLink = process.env.NURTURE_VSL_URL || bookingLink;
  const interviewLink = process.env.NURTURE_INTERVIEW_URL || bookingLink;

  const sb = svc();
  const nowIso = now.toISOString();

  const { data: due } = await sb
    .from("nurture_enrollments")
    .select("id, sequence_id, contact_id, meeting_id, current_step, enrolled_at")
    .eq("status", "active")
    .lte("next_send_at", nowIso)
    .limit(200);

  let sent = 0, completed = 0, failed = 0, claimSkip = 0, channelSkip = 0;

  for (const enr of due ?? []) {
    // Claim atomique : passe next_send_at à NULL. Un tick concurrent ne re-matchera pas
    // `next_send_at <= now` (NULL exclu) -> un seul worker envoie cette étape.
    const { data: claimed } = await sb
      .from("nurture_enrollments")
      .update({ next_send_at: null })
      .eq("id", enr.id)
      .eq("status", "active")
      .lte("next_send_at", nowIso)
      .select("id")
      .maybeSingle();
    if (!claimed) { claimSkip++; continue; }

    const { data: seq } = await sb
      .from("nurture_sequences")
      .select("id, slug, anchor, is_active, from_account_id")
      .eq("id", enr.sequence_id)
      .single();
    if (!seq || !seq.is_active) {
      await sb.from("nurture_enrollments").update({ status: "cancelled", next_send_at: null }).eq("id", enr.id);
      continue;
    }

    const nextOrder = (enr.current_step ?? 0) + 1;
    const { data: step } = await sb
      .from("nurture_steps")
      .select("step_order, delay_hours, channel, subject, body")
      .eq("sequence_id", seq.id)
      .eq("step_order", nextOrder)
      .maybeSingle();
    if (!step) {
      await sb.from("nurture_enrollments").update({ status: "completed", next_send_at: null }).eq("id", enr.id);
      completed++;
      continue;
    }

    // Canal non-email (whatsapp/sms) pas encore câblé : on n'avance pas, on repousse d'1h.
    if (step.channel !== "email") {
      await sb.from("nurture_enrollments")
        .update({ next_send_at: new Date(now.getTime() + 3600_000).toISOString() })
        .eq("id", enr.id);
      channelSkip++;
      continue;
    }

    // Ancrage 'meeting' (pré-RDV) : échéances calculées à rebours depuis le RDV.
    let meetingMs: number | null = null;
    if (seq.anchor === "meeting") {
      const { data: mtg } = await sb
        .from("meetings")
        .select("scheduled_at")
        .eq("id", enr.meeting_id ?? "")
        .maybeSingle();
      if (!mtg?.scheduled_at) {
        await sb.from("nurture_enrollments").update({ status: "cancelled", next_send_at: null }).eq("id", enr.id);
        continue;
      }
      meetingMs = new Date(mtg.scheduled_at).getTime();
      // RDV déjà passé -> on stoppe (jamais de rappel post-RDV).
      if (now.getTime() >= meetingMs) {
        await sb.from("nurture_enrollments").update({ status: "completed", next_send_at: null }).eq("id", enr.id);
        completed++;
        continue;
      }
    }

    const { data: contact } = await sb
      .from("contacts")
      .select("id, email, first_name, last_name")
      .eq("id", enr.contact_id)
      .single();
    if (!contact?.email) {
      await sb.from("nurture_enrollments").update({ status: "cancelled", next_send_at: null }).eq("id", enr.id);
      continue;
    }

    const fromAccount = seq.from_account_id
      || process.env.UNIPILE_NURTURE_ACCOUNT_ID
      || process.env.UNIPILE_DEFAULT_EMAIL_ACCOUNT_ID
      || null;
    if (!fromAccount) {
      // Pas de compte expéditeur configuré : on remet dû pour le prochain tick (fail-loud).
      await sb.from("nurture_enrollments").update({ next_send_at: nowIso }).eq("id", enr.id);
      failed++;
      continue;
    }

    const ctx = {
      firstName: contact.first_name?.trim() || "",
      bookingLink,
      vslLink,
      interviewLink,
    };
    const subject = render(step.subject ?? "", ctx);
    const body = render(step.body ?? "", ctx);
    const toName = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || null;

    const res = await sendEmail({ accountId: fromAccount, to: contact.email, toName, subject, body })
      .catch((e) => { console.error("[cron.nurture] sendEmail:", e); return { id: null }; });

    // Journal Qualiopi (transporter 'unipile'). Best-effort, ne bloque pas.
    await logEmail({
      recipient: contact.email,
      subject,
      body,
      transporter: "unipile",
      status: res.id ? "sent" : "failed",
      error: res.id ? undefined : "unipile send returned no id",
      relatedEntityType: "contact",
      relatedEntityId: contact.id,
      source: `nurture:${seq.slug}`,
    });

    if (!res.id) {
      // Échec d'envoi : on ne consomme pas l'étape, on remet dû pour retry au prochain tick.
      await sb.from("nurture_enrollments").update({ next_send_at: nowIso }).eq("id", enr.id);
      failed++;
      continue;
    }

    // Avance : prochaine étape planifiée relativement à l'enrôlement (délais absolus J+0/J+1/...).
    const { data: nextStep } = await sb
      .from("nurture_steps")
      .select("delay_hours")
      .eq("sequence_id", seq.id)
      .eq("step_order", nextOrder + 1)
      .maybeSingle();
    const nextDue = nextStep
      ? (seq.anchor === "meeting" && meetingMs !== null
          ? new Date(meetingMs - nextStep.delay_hours * 3600_000).toISOString()
          : new Date(new Date(enr.enrolled_at).getTime() + nextStep.delay_hours * 3600_000).toISOString())
      : null;

    await sb.from("nurture_enrollments").update({
      current_step: nextOrder,
      last_sent_at: new Date().toISOString(),
      next_send_at: nextDue,
      ...(nextDue ? {} : { status: "completed" }),
    }).eq("id", enr.id);

    sent++;
    if (!nextDue) completed++;
  }

  return NextResponse.json({ ok: true, sent, completed, failed, claimSkip, channelSkip });
}
