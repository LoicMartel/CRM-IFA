import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/inbox/ingest";
import { sendEmail, unipileConfigured } from "@/lib/unipile/client";
import { logEmail } from "@/lib/send-email";

// Moteur d'envoi des séquences de nurturing + relances no-show.
// Déclenché par pg_cron (Supabase) -> GET avec `Authorization: Bearer <CRON_SECRET>`.
// Idempotent + rejouable : chaque tick n'envoie qu'UNE étape par enrôlement dû. Le claim se fait
// via un LEASE (next_send_at repoussé de 15 min) et non un NULL : un tick coupé (timeout Vercel)
// laisse la ligne se ré-auto-sélectionner après le lease au lieu de l'orpheliner. Les envois partent
// de la boîte de Rafi via Unipile (canal 'email'), throttlés pour rester sous le rate-limit.

export const maxDuration = 60;

const BATCH = 25;                 // borne le nb d'envois/tick (timeout Vercel + rate-limit Unipile)
const LEASE_MS = 15 * 60_000;     // durée du claim avant ré-auto-sélection si le tick a crashé
const SEND_SPACING_MS = 600;      // ~100 envois/min max -> sous le rate-limit write d'Unipile

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Fenêtre d'envoi : 9h-19h, lundi-vendredi (heure de Paris) — cf. AC-06 WF-004. N'encadre QUE le
// drip par événement (VSL, no-show) ; les rappels pré-RDV (anchor='meeting') en sont exemptés
// (time-sensitive : un RDV le samedi/soir doit recevoir son rappel Jour-J).
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

type Seq = { id: string; slug: string; anchor: string; is_active: boolean; from_account_id: string | null };

// Échéance de l'étape `afterOrder + 1` : compte à rebours depuis le RDV si anchor='meeting',
// sinon délai absolu depuis l'enrôlement. null s'il n'y a plus d'étape (séquence terminée).
async function computeNextDue(
  sb: ReturnType<typeof svc>,
  seq: Seq,
  afterOrder: number,
  enrolledAt: string,
  meetingMs: number | null,
): Promise<string | null> {
  const { data: nextStep } = await sb
    .from("nurture_steps")
    .select("delay_hours")
    .eq("sequence_id", seq.id)
    .eq("step_order", afterOrder + 1)
    .maybeSingle();
  if (!nextStep) return null;
  if (seq.anchor === "meeting" && meetingMs !== null) {
    return new Date(meetingMs - nextStep.delay_hours * 3600_000).toISOString();
  }
  return new Date(new Date(enrolledAt).getTime() + nextStep.delay_hours * 3600_000).toISOString();
}

export async function GET(req: NextRequest) {
  // pg_cron only : pas de bypass user-agent (la route n'est pas dans vercel.json).
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fail-loud : sans Unipile, on n'envoie rien (pas de fallback silencieux sur Resend).
  if (!unipileConfigured()) {
    return NextResponse.json({ ok: false, error: "unipile-not-configured" });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const leaseIso = new Date(now.getTime() + LEASE_MS).toISOString();
  const inWindow = withinSendWindow(now);

  // Liens résolus depuis l'env (contenu client — à poser avant activation).
  const bookingLink = process.env.NURTURE_BOOKING_URL || "https://crm-lca.vercel.app/booking-general";
  const vslLink = process.env.NURTURE_VSL_URL || bookingLink;
  const interviewLink = process.env.NURTURE_INTERVIEW_URL || bookingLink;

  const sb = svc();

  const { data: due } = await sb
    .from("nurture_enrollments")
    .select("id, sequence_id, contact_id, meeting_id, current_step, enrolled_at")
    .eq("status", "active")
    .lte("next_send_at", nowIso)
    .order("next_send_at", { ascending: true })
    .limit(BATCH);

  let sent = 0, completed = 0, failed = 0, claimSkip = 0, channelSkip = 0, windowSkip = 0, bookedSkip = 0;
  let firstSend = true;

  for (const enr of due ?? []) {
    // Séquence chargée AVANT le claim : la fenêtre horaire dépend de l'ancrage.
    const { data: seq } = await sb
      .from("nurture_sequences")
      .select("id, slug, anchor, is_active, from_account_id")
      .eq("id", enr.sequence_id)
      .single();
    if (!seq || !seq.is_active) {
      await sb.from("nurture_enrollments").update({ status: "cancelled", next_send_at: null }).eq("id", enr.id).eq("status", "active");
      continue;
    }
    // Drip par événement (VSL/no-show) : respecte la fenêtre. Pré-RDV : exempté (pas de claim, on
    // laisse la ligne due -> re-tentée au prochain tick en fenêtre).
    if (seq.anchor !== "meeting" && !inWindow) { windowSkip++; continue; }

    // Claim atomique via LEASE : un 2e tick ne re-matchera pas `next_send_at <= now` (repoussé).
    const { data: claimed } = await sb
      .from("nurture_enrollments")
      .update({ next_send_at: leaseIso })
      .eq("id", enr.id)
      .eq("status", "active")
      .lte("next_send_at", nowIso)
      .select("id")
      .maybeSingle();
    if (!claimed) { claimSkip++; continue; }

    // Garde « il a (re)booké » : une séquence de RELANCE ne doit jamais partir vers un contact qui a
    // un RDV à venir (incident 28/07 : breakup « Je clôture votre dossier ? » envoyé à une prospecte
    // qui avait rebooké la veille depuis l'UI CRM). La coupure à la source est le trigger
    // trg_exit_nurture_on_booking ; ceci est la 2e ligne — elle couvre l'enrôlement créé APRÈS la
    // prise de RDV (trigger no-show sur un ancien RDV) et les RDV backfillés hors trigger.
    // 'pre-rdv' (anchor='meeting') est exempté : c'est justement la séquence qui prépare ce RDV.
    if (seq.anchor !== "meeting") {
      const { data: upcoming } = await sb
        .from("meetings")
        .select("id")
        .eq("contact_id", enr.contact_id)
        .eq("status", "booked")
        .gt("scheduled_at", nowIso)
        .limit(1);
      if (upcoming?.length) {
        await sb.from("nurture_enrollments")
          .update({ status: "exited_booked", next_send_at: null })
          .eq("id", enr.id);
        bookedSkip++;
        continue;
      }
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

    // Ancrage 'meeting' (pré-RDV) : échéances à rebours depuis le RDV + garde post-RDV.
    let meetingMs: number | null = null;
    if (seq.anchor === "meeting") {
      const { data: mtg } = await sb.from("meetings").select("scheduled_at").eq("id", enr.meeting_id ?? "").maybeSingle();
      if (!mtg?.scheduled_at) {
        await sb.from("nurture_enrollments").update({ status: "cancelled", next_send_at: null }).eq("id", enr.id);
        continue;
      }
      meetingMs = new Date(mtg.scheduled_at).getTime();
      if (now.getTime() >= meetingMs) {
        await sb.from("nurture_enrollments").update({ status: "completed", next_send_at: null }).eq("id", enr.id);
        completed++;
        continue;
      }
    }

    // Canal non-email (whatsapp/sms) pas encore câblé : on AVANCE (skip) pour ne pas staller.
    if (step.channel !== "email") {
      const nextDue = await computeNextDue(sb, seq, nextOrder, enr.enrolled_at, meetingMs);
      await sb.from("nurture_enrollments").update({
        current_step: nextOrder,
        next_send_at: nextDue,
        ...(nextDue ? {} : { status: "completed" }),
      }).eq("id", enr.id);
      console.warn(`[cron.nurture] step ${seq.slug}#${nextOrder} channel '${step.channel}' not wired — skipped`);
      channelSkip++;
      continue;
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
      await sb.from("nurture_enrollments").update({ next_send_at: nowIso }).eq("id", enr.id); // fail-loud, retry
      failed++;
      continue;
    }

    const ctx = { firstName: contact.first_name?.trim() || "", bookingLink, vslLink, interviewLink };
    const subject = render(step.subject ?? "", ctx);
    const body = render(step.body ?? "", ctx);
    const toName = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || null;

    // Throttle inter-envois (rate-limit Unipile). Pas de pause avant le 1er.
    if (!firstSend) await sleep(SEND_SPACING_MS);
    firstSend = false;

    // Succès = pas de throw (Unipile a renvoyé 2xx). `unipilePost` throw sur non-2xx ; un 2xx sans
    // provider_id renvoie {id:null} mais L'EMAIL EST PARTI -> on avance quand même (évite le double-envoi).
    let sendOk = false;
    let sendId: string | null = null;
    try {
      const r = await sendEmail({ accountId: fromAccount, to: contact.email, toName, subject, body });
      sendId = r.id;
      sendOk = true;
    } catch (e) {
      console.error("[cron.nurture] sendEmail failed:", e instanceof Error ? e.message : String(e));
    }

    await logEmail({
      recipient: contact.email,
      subject,
      body,
      transporter: "unipile",
      status: sendOk ? "sent" : "failed",
      error: sendOk ? undefined : "unipile send failed (non-2xx or network)",
      relatedEntityType: "contact",
      relatedEntityId: contact.id,
      source: `nurture:${seq.slug}${sendId ? "" : ":no-id"}`,
    });

    if (!sendOk) {
      // Vrai échec (non-2xx / réseau avant réponse) : re-dû pour retry au prochain tick.
      await sb.from("nurture_enrollments").update({ next_send_at: nowIso }).eq("id", enr.id);
      failed++;
      continue;
    }

    const nextDue = await computeNextDue(sb, seq, nextOrder, enr.enrolled_at, meetingMs);
    await sb.from("nurture_enrollments").update({
      current_step: nextOrder,
      last_sent_at: new Date().toISOString(),
      next_send_at: nextDue,
      ...(nextDue ? {} : { status: "completed" }),
    }).eq("id", enr.id);

    sent++;
    if (!nextDue) completed++;
  }

  return NextResponse.json({ ok: true, sent, completed, failed, claimSkip, channelSkip, windowSkip, bookedSkip });
}
