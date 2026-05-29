import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireMember } from "@/lib/api-auth";
import { getCalendarEventsAllPages } from "@/lib/google-calendar";

export const maxDuration = 30;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CITY_REGION: Record<string, string> = {
  Paris: "Île-de-France", Mérignac: "Nouvelle-Aquitaine", Bordeaux: "Nouvelle-Aquitaine",
  Montpellier: "Occitanie", Toulouse: "Occitanie", Lyon: "Auvergne-Rhône-Alpes",
  Marseille: "Provence-Alpes-Côte d'Azur", Nantes: "Pays de la Loire", Lille: "Hauts-de-France",
  Strasbourg: "Grand Est", Rennes: "Bretagne", Nice: "Provence-Alpes-Côte d'Azur",
  Rouen: "Normandie", Dijon: "Bourgogne-Franche-Comté", "Clermont-Ferrand": "Auvergne-Rhône-Alpes",
  "La Rochelle": "Nouvelle-Aquitaine", Limoges: "Nouvelle-Aquitaine", Poitiers: "Nouvelle-Aquitaine",
  Orléans: "Centre-Val de Loire", Tours: "Centre-Val de Loire", Reims: "Grand Est",
  Amiens: "Hauts-de-France", Caen: "Normandie", Angers: "Pays de la Loire",
  Grenoble: "Auvergne-Rhône-Alpes", "Saint-Étienne": "Auvergne-Rhône-Alpes",
  Toulon: "Provence-Alpes-Côte d'Azur", "Aix-en-Provence": "Provence-Alpes-Côte d'Azur",
  Brest: "Bretagne", Perpignan: "Occitanie", Nîmes: "Occitanie", Pau: "Nouvelle-Aquitaine",
  Bayonne: "Nouvelle-Aquitaine", Metz: "Grand Est", Nancy: "Grand Est",
};

const DAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

interface SessionMeta {
  index: number;
  session_type: "vt" | "journee";
  duration_hours: number;
  session_location: string | null;
}

interface Proposal {
  session_date: string;
  session_time: string;
  duration_hours: number;
  trainer_name: string;
  trainer_id: string;
  warning?: string;
}

interface TrainerData {
  id: string;
  firstName: string;
  name: string;
  score: number;
  hasExpertise: boolean;
  sameRegion: boolean;
  budgetOk: boolean;
  tjm: number;
  totalHT: number;
  marge: number;
  busyEvents: { start: string; end: string; summary?: string }[];
  hasCalendar: boolean;
}

function parseRhythm(rhythm: string): { intervalDays: number } {
  switch (rhythm) {
    case "1x/semaine": return { intervalDays: 7 };
    case "2x/semaine": return { intervalDays: 3 };
    case "1x/2 semaines": return { intervalDays: 14 };
    case "1x/mois": return { intervalDays: 30 };
    case "2x/mois": return { intervalDays: 14 };
    case "1x/2 mois": return { intervalDays: 60 };
    default: return { intervalDays: 7 };
  }
}

function isConflicting(
  date: string, time: string, durationHours: number,
  busyEvents: { start: string; end: string }[]
): boolean {
  const BUFFER = 15 * 60 * 1000;
  const slotStart = new Date(`${date}T${time}:00+02:00`).getTime();
  const slotEnd = slotStart + durationHours * 60 * 60 * 1000;

  return busyEvents.some((b) => {
    const bs = new Date(b.start).getTime() - BUFFER;
    const be = new Date(b.end).getTime() + BUFFER;
    return slotStart < be && slotEnd > bs;
  });
}

/** Build the ordered list of all sessions to plan (VT first, then journees) */
function buildSessionList(params: {
  vtCount: number; vtDuration: number; daysCount: number;
  journeeDuration: number; journeeLocation: string;
}): SessionMeta[] {
  const sessions: SessionMeta[] = [];
  for (let i = 0; i < params.vtCount; i++) {
    sessions.push({
      index: sessions.length,
      session_type: "vt",
      duration_hours: params.vtDuration,
      session_location: null,
    });
  }
  const jourDur = params.journeeDuration > 0 ? params.journeeDuration : 8;
  for (let i = 0; i < params.daysCount; i++) {
    sessions.push({
      index: sessions.length,
      session_type: "journee",
      duration_hours: jourDur,
      session_location: params.journeeLocation || null,
    });
  }
  return sessions;
}

/** Build preferred time slots from a time range string */
function buildPreferredSlots(timeSlotStr: string): string[] {
  if (!timeSlotStr) return ["09:00", "09:30", "10:00", "10:30", "11:00", "14:00", "14:30", "15:00", "15:30", "16:00"];
  if (timeSlotStr.includes("-")) {
    const [startStr, endStr] = timeSlotStr.split("-").map((s: string) => s.trim());
    const [sH, sM] = startStr.split(":").map(Number);
    const [eH, eM] = endStr.split(":").map(Number);
    const startMin = sH * 60 + sM;
    const endMin = eH * 60 + eM;
    const slots: string[] = [];
    for (let t = startMin; t < endMin; t += 30) {
      slots.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
    }
    return slots.length > 0 ? slots : [startStr];
  }
  if (timeSlotStr.includes(",")) return timeSlotStr.split(",").map((s: string) => s.trim()).filter(Boolean);
  return [timeSlotStr];
}

/**
 * Generate target dates for a session at a given index, respecting rhythm and client availability.
 * Returns candidate dates in the expected time window for this session index.
 */
function generateTargetDates(
  sessionIndex: number, sessionType: "vt" | "journee",
  startDate: string, endDate: string,
  vtRhythm: string, journeeRhythm: string,
  clientAvailableDays: string[],
  vtCount: number,
  alreadyBooked: { session_date: string; session_type: string }[]
): string[] {
  const rhythm = sessionType === "vt" ? vtRhythm : journeeRhythm;
  const { intervalDays } = parseRhythm(rhythm);
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T23:59:59");

  // Calculate the session's position within its type
  const typeIndex = sessionType === "vt"
    ? sessionIndex
    : sessionIndex - vtCount;

  // Target start = start + typeIndex * intervalDays (approximate window)
  const windowStart = new Date(start);
  windowStart.setDate(windowStart.getDate() + typeIndex * intervalDays);

  // If window start is before the range start, clamp it
  if (windowStart < start) windowStart.setTime(start.getTime());

  const bookedDates = new Set(alreadyBooked.map(s => s.session_date));

  // Collect candidate dates in a window of intervalDays (or 7 days minimum)
  const windowSize = Math.max(intervalDays, 7);
  const candidates: string[] = [];

  for (let d = 0; d < windowSize * 2 && candidates.length < 10; d++) {
    const cur = new Date(windowStart);
    cur.setDate(cur.getDate() + d);
    if (cur > end) break;
    const dayName = DAY_NAMES[cur.getDay()];
    if (clientAvailableDays.length > 0 && !clientAvailableDays.includes(dayName)) continue;
    const dateStr = cur.toISOString().split("T")[0];
    if (bookedDates.has(dateStr)) continue;

    // Don't put journee on a day that already has a VT booked, and vice-versa
    const conflictType = alreadyBooked.find(s => s.session_date === dateStr);
    if (conflictType && conflictType.session_type !== sessionType) continue;

    candidates.push(dateStr);
  }

  return candidates;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireMember();
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const {
      planId, expertise, city, budget,
      clientAvailableDays, vtRhythm, vtTimeSlot, vtDuration,
      journeeRhythm, journeeTimeFrom, journeeDuration, journeeLocation,
      startDate, endDate, vtCount, daysCount,
      selectedTrainerIds,
      // New: single-session mode
      sessionIndex: requestedSessionIndex,
      alreadyBooked: alreadyBookedInput,
    } = body;

    const isSingleSessionMode = typeof requestedSessionIndex === "number";
    const alreadyBooked: { session_date: string; session_time: string; duration_hours: number; session_type: string; trainer_name: string }[] = alreadyBookedInput ?? [];

    // Fetch plan format
    let planFormat = "individuel";
    if (planId) {
      const { data: plan } = await supabase.from("service_plans").select("format").eq("id", planId).single();
      if (plan?.format) planFormat = plan.format;
    }

    // Fetch and score experts
    const { data: teamMembers } = await supabase
      .from("team_members")
      .select("id, first_name, last_name, roles, expertises, city, region, tjm, days_per_week, preferred_days, mobility, google_calendar_id, google_calendar_id_presentiel")
      .eq("is_active", true);

    const experts = (teamMembers ?? []).filter((m: any) =>
      ((m.roles as string[]) ?? []).some((r: string) => r === "Expert" || r === "Experte") && m.tjm
    );

    const formationRegion = CITY_REGION[city] ?? "";
    const nbDays = parseFloat(daysCount) || 0;
    const hasJournees = nbDays > 0;
    const budgetHT = parseFloat(budget) || 0;

    const scored = experts.map((m: any) => {
      const exps = (m.expertises as string[]) ?? [];
      const hasExpertise = expertise ? exps.includes(expertise) : false;
      const expertRegion = (m.region as string) || "";
      const sameRegion = hasJournees && !!(formationRegion && expertRegion && expertRegion === formationRegion);
      const tjm = Number(m.tjm) || 0;
      const costTjm = tjm * nbDays;
      const prepa = tjm * 0.5;
      const deplacement = (hasJournees && !sameRegion) ? tjm * 0.5 : 0;
      const totalHT = costTjm + prepa + deplacement;
      const budgetOk = budgetHT > 0 ? totalHT <= budgetHT : true;
      const score = (hasExpertise ? 1 : 0) + (sameRegion ? 1 : 0) + (budgetOk ? 1 : 0);
      const marge = budgetHT > 0 ? budgetHT - totalHT : 0;
      return {
        id: m.id as string,
        firstName: m.first_name as string,
        name: `${m.first_name} ${m.last_name}`,
        score, hasExpertise, sameRegion, budgetOk,
        tjm, totalHT, marge,
        googleCalendarId: m.google_calendar_id as string | null,
        googleCalendarIdPresentiel: m.google_calendar_id_presentiel as string | null,
      };
    }).sort((a: any, b: any) => b.score - a.score || a.totalHT - b.totalHT);

    // Select trainers
    const selectedIds = (selectedTrainerIds as string[] | undefined) ?? [];
    let topCandidates;
    if (selectedIds.length > 0) {
      topCandidates = selectedIds
        .map((id: string) => scored.find((s: any) => s.id === id))
        .filter(Boolean);
    } else {
      topCandidates = scored.slice(0, 3);
    }

    if (topCandidates.length === 0) {
      return NextResponse.json({ success: false, error: "Aucun expert trouvé correspondant aux critères" });
    }

    // Scan calendars
    const timeMin = new Date(`${startDate}T00:00:00`).toISOString();
    const timeMax = new Date(`${endDate}T23:59:59`).toISOString();

    const trainersWithBusy: TrainerData[] = await Promise.all(
      topCandidates.map(async (candidate: any) => {
        const calIds = [candidate.googleCalendarId, candidate.googleCalendarIdPresentiel].filter(Boolean) as string[];
        const allEvents: { start: string; end: string; summary?: string }[] = [];

        for (const calId of calIds) {
          const { events } = await getCalendarEventsAllPages({ calendarId: calId, timeMin, timeMax });
          allEvents.push(...events);
        }

        return {
          id: candidate.id,
          firstName: candidate.firstName,
          name: candidate.name,
          score: candidate.score,
          hasExpertise: candidate.hasExpertise,
          sameRegion: candidate.sameRegion,
          budgetOk: candidate.budgetOk,
          tjm: candidate.tjm,
          totalHT: candidate.totalHT,
          marge: candidate.marge,
          busyEvents: allEvents,
          hasCalendar: calIds.length > 0,
        };
      })
    );

    // Build the full session list
    const vtTotal = parseInt(vtCount) || 0;
    const vtDur = parseFloat(vtDuration) || 1;
    const jourTotal = parseInt(daysCount) || 0;
    const jourDur = parseFloat(journeeDuration) || 8;
    const jourStartTime = journeeTimeFrom || "09:00";
    const sessionList = buildSessionList({
      vtCount: vtTotal, vtDuration: vtDur,
      daysCount: jourTotal, journeeDuration: jourDur, journeeLocation: journeeLocation || "",
    });

    // ─── SINGLE SESSION MODE ───
    if (isSingleSessionMode) {
      if (requestedSessionIndex >= sessionList.length) {
        return NextResponse.json({
          success: true,
          sessionMeta: null,
          proposals: [],
          trainerCalendars: [],
          done: true,
          totalSessions: sessionList.length,
        });
      }

      const sessionMeta = sessionList[requestedSessionIndex];
      const preferredSlots = buildPreferredSlots(vtTimeSlot);
      // VT never before 9h (business rule)
      const allDaySlots: string[] = [];
      for (let h = 9; h <= 17; h++) {
        for (const m of ["00", "30"]) allDaySlots.push(`${String(h).padStart(2, "0")}:${m}`);
      }

      // Add already-booked sessions as "busy" for conflict checking
      const bookedAsBusy = alreadyBooked.map(s => ({
        start: `${s.session_date}T${s.session_time}:00+02:00`,
        end: new Date(new Date(`${s.session_date}T${s.session_time}:00+02:00`).getTime() + s.duration_hours * 3600000).toISOString(),
      }));

      // Get candidate dates for this session
      const candidateDates = generateTargetDates(
        requestedSessionIndex, sessionMeta.session_type,
        startDate, endDate, vtRhythm, journeeRhythm || "1x/mois",
        clientAvailableDays, vtTotal, alreadyBooked
      );

      // Find 2-3 proposals across trainers and dates
      // Two-pass approach: first try ONLY preferred slots, then fallback to any slot
      const proposals: Proposal[] = [];
      const usedSlots = new Set<string>(); // "date|time|trainer" to avoid duplicates
      const fallbackSlots = allDaySlots.filter(s => !preferredSlots.includes(s));

      function tryFindVTProposal(date: string, trainer: TrainerData, slots: string[]): boolean {
        const combinedBusy = [...trainer.busyEvents, ...bookedAsBusy];
        for (const slot of slots) {
          const key = `${date}|${slot}|${trainer.id}`;
          if (usedSlots.has(key)) continue;
          if (!isConflicting(date, slot, sessionMeta!.duration_hours, combinedBusy)) {
            const tooSimilar = proposals.some(p =>
              p.session_date === date && p.trainer_id === trainer.id &&
              Math.abs(timeToMinutes(p.session_time) - timeToMinutes(slot)) < 60
            );
            if (tooSimilar) continue;

            usedSlots.add(key);
            proposals.push({
              session_date: date,
              session_time: slot,
              duration_hours: sessionMeta!.duration_hours,
              trainer_name: trainer.firstName,
              trainer_id: trainer.id,
              warning: trainer !== trainersWithBusy[0] ? `${trainersWithBusy[0].firstName} indisponible` : undefined,
            });
            return true;
          }
        }
        return false;
      }

      // Pass 1: preferred slots only (respect client's time preference)
      for (const date of candidateDates) {
        if (proposals.length >= 3) break;
        for (const trainer of trainersWithBusy) {
          if (proposals.length >= 3) break;

          if (sessionMeta.session_type === "vt") {
            tryFindVTProposal(date, trainer, preferredSlots);
          } else {
            const combinedBusy = [...trainer.busyEvents, ...bookedAsBusy];
            if (!isConflicting(date, jourStartTime, sessionMeta.duration_hours, combinedBusy)) {
              const key = `${date}|${jourStartTime}|${trainer.id}`;
              if (!usedSlots.has(key)) {
                usedSlots.add(key);
                proposals.push({
                  session_date: date,
                  session_time: jourStartTime,
                  duration_hours: sessionMeta.duration_hours,
                  trainer_name: trainer.firstName,
                  trainer_id: trainer.id,
                  warning: trainer !== trainersWithBusy[0] ? `${trainersWithBusy[0].firstName} indisponible` : undefined,
                });
              }
            }
          }
        }
      }

      // Pass 2: fallback to any available slot if we still need more proposals
      if (proposals.length < 2) {
        for (const date of candidateDates) {
          if (proposals.length >= 3) break;
          for (const trainer of trainersWithBusy) {
            if (proposals.length >= 3) break;
            if (sessionMeta.session_type === "vt") {
              tryFindVTProposal(date, trainer, fallbackSlots);
            }
          }
        }
      }

      // Return all trainer calendar events for the full date range (enables day navigation in UI)
      const trainerCalendars = trainersWithBusy.map(t => ({
        trainerName: t.firstName,
        trainerId: t.id,
        events: t.busyEvents.map(e => ({ start: e.start, end: e.end, summary: e.summary })),
      }));

      return NextResponse.json({
        success: true,
        sessionMeta: {
          index: requestedSessionIndex,
          total: sessionList.length,
          session_type: sessionMeta.session_type,
          duration_hours: sessionMeta.duration_hours,
          session_location: sessionMeta.session_location,
        },
        proposals,
        trainerCalendars,
        done: false,
        totalSessions: sessionList.length,
        // Also return the full session list summary for progress display
        allSessions: sessionList.map(s => ({
          index: s.index,
          session_type: s.session_type,
          duration_hours: s.duration_hours,
        })),
      });
    }

    // ─── LEGACY BATCH MODE (kept for backward compatibility) ───
    const proposedSessions: { session_type: "vt" | "journee"; session_date: string; session_time: string; duration_hours: number; trainer_name: string; session_location: string | null; warning?: string }[] = [];
    const warnings: string[] = [];
    const bookedDates = new Set<string>();
    const bookedWeeks = new Map<string, "vt" | "journee">();

    function getWeekKey(dateStr: string): string {
      const d = new Date(dateStr + "T00:00:00");
      const jan1 = new Date(d.getFullYear(), 0, 1);
      const dayOfYear = Math.floor((d.getTime() - jan1.getTime()) / 86400000) + 1;
      const weekNum = Math.ceil((dayOfYear + jan1.getDay()) / 7);
      return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
    }

    function canPlaceVTInWeek(dateStr: string): boolean {
      if (planFormat === "collectif") {
        const wk = getWeekKey(dateStr);
        return bookedWeeks.get(wk) !== "journee";
      }
      return true;
    }

    function canPlaceJourneeInWeek(dateStr: string): boolean {
      if (planFormat === "collectif") {
        const wk = getWeekKey(dateStr);
        return bookedWeeks.get(wk) !== "vt";
      }
      return true;
    }

    const preferredSlots = buildPreferredSlots(vtTimeSlot);
    // VT never before 9h (business rule)
    const allDaySlots: string[] = [];
    for (let h = 9; h <= 17; h++) {
      for (const m of ["00", "30"]) allDaySlots.push(`${String(h).padStart(2, "0")}:${m}`);
    }

    function getAvailableDaysInWindow(windowStart: Date, windowDays: number, availDays: string[]): string[] {
      const dates: string[] = [];
      const end = new Date(endDate + "T23:59:59");
      for (let d = 0; d < windowDays; d++) {
        const cur = new Date(windowStart);
        cur.setDate(cur.getDate() + d);
        if (cur > end) break;
        const dayName = DAY_NAMES[cur.getDay()];
        if (availDays.length === 0 || availDays.includes(dayName)) {
          dates.push(cur.toISOString().split("T")[0]);
        }
      }
      return dates;
    }

    function tryAssignVT(date: string, duration: number, trainer: TrainerData): string | null {
      for (const slot of preferredSlots) {
        if (!isConflicting(date, slot, duration, trainer.busyEvents)) return slot;
      }
      for (const slot of allDaySlots) {
        if (!isConflicting(date, slot, duration, trainer.busyEvents)) return slot;
      }
      return null;
    }

    function tryAssignJournee(date: string, trainer: TrainerData): boolean {
      return !isConflicting(date, jourStartTime, jourDur, trainer.busyEvents);
    }

    function findSlotFlexible(
      windowStart: Date, windowDays: number, sessionType: "vt" | "journee",
      duration: number, availDays: string[]
    ): { session_type: "vt" | "journee"; session_date: string; session_time: string; duration_hours: number; trainer_name: string; session_location: string | null; warning?: string } | null {
      const candidateDays = getAvailableDaysInWindow(windowStart, windowDays, availDays);

      for (const trainer of trainersWithBusy) {
        for (const date of candidateDays) {
          const hasJournee = proposedSessions.some(s => s.session_date === date && s.session_type === "journee");
          const hasVT = proposedSessions.some(s => s.session_date === date && s.session_type === "vt");
          if (sessionType === "journee" && hasVT) continue;
          if (sessionType === "vt" && hasJournee) continue;
          if (sessionType === "vt" && !canPlaceVTInWeek(date)) continue;
          if (sessionType === "journee" && !canPlaceJourneeInWeek(date)) continue;

          if (sessionType === "vt") {
            const slot = tryAssignVT(date, duration, trainer);
            if (slot) {
              const isAlternative = trainer !== trainersWithBusy[0];
              if (isAlternative) warnings.push(`${date} (VT) : ${trainersWithBusy[0].firstName} indisponible → ${trainer.firstName}`);
              return {
                session_type: "vt", session_date: date, session_time: slot,
                duration_hours: duration, trainer_name: trainer.firstName,
                session_location: null,
                warning: isAlternative ? `${trainersWithBusy[0].firstName} indisponible` : undefined,
              };
            }
          } else {
            if (tryAssignJournee(date, trainer)) {
              const isAlternative = trainer !== trainersWithBusy[0];
              if (isAlternative) warnings.push(`${date} (Journée) : ${trainersWithBusy[0].firstName} indisponible → ${trainer.firstName}`);
              return {
                session_type: "journee", session_date: date, session_time: jourStartTime,
                duration_hours: jourDur, trainer_name: trainer.firstName,
                session_location: journeeLocation || null,
                warning: isAlternative ? `${trainersWithBusy[0].firstName} indisponible` : undefined,
              };
            }
          }
        }
      }
      return null;
    }

    const { intervalDays: vtInterval } = parseRhythm(vtRhythm);
    const { intervalDays: journeeInterval } = parseRhythm(journeeRhythm || "1x/mois");
    const rangeStart = new Date(startDate + "T00:00:00");
    const rangeEnd = new Date(endDate + "T23:59:59");

    if (vtTotal > 0) {
      const cursor = new Date(rangeStart);
      let placed = 0;
      while (cursor <= rangeEnd && placed < vtTotal) {
        const session = findSlotFlexible(cursor, Math.min(vtInterval, 7), "vt", vtDur, clientAvailableDays);
        if (session) {
          proposedSessions.push(session);
          bookedDates.add(session.session_date);
          bookedWeeks.set(getWeekKey(session.session_date), "vt");
          placed++;
        }
        cursor.setDate(cursor.getDate() + vtInterval);
      }
    }

    if (jourTotal > 0) {
      const cursor = new Date(rangeStart);
      let placed = 0;
      while (cursor <= rangeEnd && placed < jourTotal) {
        const session = findSlotFlexible(cursor, Math.min(journeeInterval, 14), "journee", jourDur, clientAvailableDays);
        if (session) {
          proposedSessions.push(session);
          bookedDates.add(session.session_date);
          bookedWeeks.set(getWeekKey(session.session_date), "journee");
          placed++;
        }
        cursor.setDate(cursor.getDate() + journeeInterval);
      }
    }

    proposedSessions.sort((a, b) => a.session_date.localeCompare(b.session_date));

    for (const t of trainersWithBusy) {
      if (!t.hasCalendar) {
        warnings.push(`${t.name} : pas de Google Calendar lié — disponibilité non vérifiable`);
      }
    }

    const primaryTrainer = trainersWithBusy[0];
    const primaryAssigned = proposedSessions.filter(s => s.trainer_name === primaryTrainer.firstName && !s.warning).length;

    return NextResponse.json({
      success: true,
      proposedSessions,
      selectedTrainer: {
        ...primaryTrainer,
        busyEvents: undefined,
        availabilityPct: proposedSessions.length > 0 ? Math.round(primaryAssigned / proposedSessions.length * 100) : 100,
        coveredSessions: primaryAssigned,
        totalSessions: proposedSessions.length,
      },
      alternativeTrainers: trainersWithBusy.slice(1).map(t => ({
        ...t,
        busyEvents: undefined,
        availabilityPct: 0,
        coveredSessions: proposedSessions.filter(s => s.trainer_name === t.firstName).length,
        totalSessions: proposedSessions.length,
      })),
      warnings,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
