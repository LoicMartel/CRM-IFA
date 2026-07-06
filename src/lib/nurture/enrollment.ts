import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Enrôlement / désenrôlement dans les séquences de nurturing. Appelé depuis les call sites
// (leads/inbound, booking/confirm, webhook Unipile). Best-effort : ne bloque JAMAIS le flux
// appelant (un échec de nurturing ne doit pas casser une prise de RDV ou l'ingestion d'un lead).
// Client service-role non typé : les tables nurture_* ne sont pas dans les types générés.

let client: SupabaseClient | null = null;
function svc(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

/**
 * Enrôle un contact dans une séquence (idempotent via unique sequence_id/contact_id).
 * - anchor='enrollment' : 1re étape planifiée à now + delay(step 1).
 * - anchor='meeting' (pré-RDV) : compte à rebours depuis meetings.scheduled_at. Les étapes déjà
 *   passées sont sautées ; si le RDV est trop proche pour toute étape à venir, pas d'enrôlement.
 */
export async function enrollContact(opts: {
  sequenceSlug: string;
  contactId: string;
  meetingId?: string | null;
}): Promise<void> {
  try {
    const sb = svc();
    if (!sb) return;

    const { data: seq } = await sb
      .from("nurture_sequences")
      .select("id, anchor, is_active")
      .eq("slug", opts.sequenceSlug)
      .maybeSingle();
    if (!seq || !seq.is_active) return;

    const { data: steps } = await sb
      .from("nurture_steps")
      .select("step_order, delay_hours")
      .eq("sequence_id", seq.id)
      .order("step_order", { ascending: true });
    if (!steps?.length) return;

    let currentStep = 0;
    let nextSendAt: string;

    if (seq.anchor === "meeting") {
      if (!opts.meetingId) return;
      const { data: mtg } = await sb
        .from("meetings")
        .select("scheduled_at")
        .eq("id", opts.meetingId)
        .maybeSingle();
      if (!mtg?.scheduled_at) return;
      const meetingMs = new Date(mtg.scheduled_at).getTime();
      const nowMs = Date.now();
      // 1re étape dont l'envoi (scheduled_at - delai) est encore dans le futur.
      const firstFuture = steps.find((s) => meetingMs - s.delay_hours * 3600_000 > nowMs);
      if (!firstFuture) return; // RDV trop proche : aucune étape à venir
      currentStep = firstFuture.step_order - 1;
      nextSendAt = new Date(meetingMs - firstFuture.delay_hours * 3600_000).toISOString();
    } else {
      currentStep = 0;
      nextSendAt = new Date(Date.now() + steps[0].delay_hours * 3600_000).toISOString();
    }

    const { error } = await sb.from("nurture_enrollments").insert({
      sequence_id: seq.id,
      contact_id: opts.contactId,
      meeting_id: opts.meetingId ?? null,
      status: "active",
      current_step: currentStep,
      next_send_at: nextSendAt,
    });
    // 23505 = un enrôlement ACTIF existe déjà pour ce (séquence, contact) -> no-op idempotent
    // (index partiel nurture_enrollments_active_uidx). Toute autre erreur est loggée.
    if (error && error.code !== "23505") {
      console.error("[nurture.enroll] insert failed (non-blocking):", error.message);
    }
  } catch (e) {
    console.error("[nurture.enroll] failed (non-blocking):", e instanceof Error ? e.message : String(e));
  }
}

/**
 * Sort un contact de TOUTES ses séquences actives (il a booké, ou il a répondu).
 * reason : 'exited_booked' | 'exited_replied' | 'cancelled'.
 */
export async function exitEnrollments(opts: {
  contactId: string;
  reason: "exited_booked" | "exited_replied" | "cancelled";
}): Promise<void> {
  try {
    const sb = svc();
    if (!sb) return;
    await sb
      .from("nurture_enrollments")
      .update({ status: opts.reason, next_send_at: null })
      .eq("contact_id", opts.contactId)
      .eq("status", "active");
  } catch (e) {
    console.error("[nurture.exit] failed (non-blocking):", e instanceof Error ? e.message : String(e));
  }
}
