import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
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

interface ProposedSession {
  session_type: "vt" | "journee";
  session_date: string;
  session_time: string;
  duration_hours: number;
  trainer_name: string;
  session_location: string | null;
  warning?: string;
}

interface TrainerData {
  firstName: string;
  name: string;
  score: number;
  hasExpertise: boolean;
  sameRegion: boolean;
  budgetOk: boolean;
  tjm: number;
  totalHT: number;
  marge: number;
  busyEvents: { start: string; end: string }[];
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

function generateCandidateDates(
  startDate: string, endDate: string, rhythm: string,
  availableDays: string[], count: number
): string[] {
  const { intervalDays } = parseRhythm(rhythm);
  const dates: string[] = [];
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T23:59:59");
  const cursor = new Date(start);

  while (cursor <= end && dates.length < count) {
    const dayName = DAY_NAMES[cursor.getDay()];
    if (availableDays.length === 0 || availableDays.includes(dayName)) {
      const dateStr = cursor.toISOString().split("T")[0];
      dates.push(dateStr);
      cursor.setDate(cursor.getDate() + intervalDays);
      // Skip to next available day if we landed on an unavailable day
      while (availableDays.length > 0 && !availableDays.includes(DAY_NAMES[cursor.getDay()]) && cursor <= end) {
        cursor.setDate(cursor.getDate() + 1);
      }
    } else {
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return dates;
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      planId, expertise, city, budget,
      clientAvailableDays, vtRhythm, vtTimeSlot, vtDuration,
      journeeRhythm, journeeLocation,
      startDate, endDate, vtCount, daysCount,
    } = body;

    // Fetch plan format to know if sessions are individual or group
    let planFormat = "individuel"; // default: individual VTs can coexist with journées same week
    if (planId) {
      const { data: plan } = await supabase.from("service_plans").select("format").eq("id", planId).single();
      if (plan?.format) planFormat = plan.format;
    }

    // Step A: Fetch and score experts
    const { data: teamMembers } = await supabase
      .from("team_members")
      .select("id, first_name, last_name, roles, expertises, city, region, tjm, days_per_week, preferred_days, mobility, google_calendar_id, google_calendar_id_presentiel")
      .eq("is_active", true);

    const experts = (teamMembers ?? []).filter((m: any) =>
      ((m.roles as string[]) ?? []).some((r: string) => r === "Expert" || r === "Experte") && m.tjm
    );

    const formationRegion = CITY_REGION[city] ?? "";
    const nbDays = parseFloat(daysCount) || 0;
    const budgetHT = parseFloat(budget) || 0;

    const scored = experts.map((m: any) => {
      const exps = (m.expertises as string[]) ?? [];
      const hasExpertise = expertise ? exps.includes(expertise) : false;
      const expertRegion = (m.region as string) || "";
      const sameRegion = !!(formationRegion && expertRegion && expertRegion === formationRegion);
      const tjm = Number(m.tjm) || 0;
      const costTjm = tjm * nbDays;
      const prepa = tjm * 0.5;
      const deplacement = sameRegion ? 0 : tjm * 0.5;
      const totalHT = costTjm + prepa + deplacement;
      const budgetOk = budgetHT > 0 ? totalHT <= budgetHT : true;
      const score = (hasExpertise ? 1 : 0) + (sameRegion ? 1 : 0) + (budgetOk ? 1 : 0);
      const marge = budgetHT > 0 ? budgetHT - totalHT : 0;
      return {
        firstName: m.first_name as string,
        name: `${m.first_name} ${m.last_name}`,
        score, hasExpertise, sameRegion, budgetOk,
        tjm, totalHT, marge,
        googleCalendarId: m.google_calendar_id as string | null,
        googleCalendarIdPresentiel: m.google_calendar_id_presentiel as string | null,
      };
    }).sort((a: any, b: any) => b.score - a.score || a.totalHT - b.totalHT);

    const topCandidates = scored.slice(0, 3);

    if (topCandidates.length === 0) {
      return NextResponse.json({ success: false, error: "Aucun expert trouvé correspondant aux critères" });
    }

    // Step B: Scan calendars in parallel
    const timeMin = new Date(`${startDate}T00:00:00`).toISOString();
    const timeMax = new Date(`${endDate}T23:59:59`).toISOString();

    const trainersWithBusy: TrainerData[] = await Promise.all(
      topCandidates.map(async (candidate: any) => {
        const calIds = [candidate.googleCalendarId, candidate.googleCalendarIdPresentiel].filter(Boolean) as string[];
        const allEvents: { start: string; end: string }[] = [];

        for (const calId of calIds) {
          const { events } = await getCalendarEventsAllPages({ calendarId: calId, timeMin, timeMax });
          allEvents.push(...events);
        }

        return {
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

    // Step C: Generate schedule with flexible date finding
    const proposedSessions: ProposedSession[] = [];
    const warnings: string[] = [];
    const bookedDates = new Set<string>(); // Track dates already used
    const bookedWeeks = new Map<string, "vt" | "journee">(); // Track weeks with journée (for collectif format)

    // Helper: get ISO week key "2026-W19"
    function getWeekKey(dateStr: string): string {
      const d = new Date(dateStr + "T00:00:00");
      const jan1 = new Date(d.getFullYear(), 0, 1);
      const dayOfYear = Math.floor((d.getTime() - jan1.getTime()) / 86400000) + 1;
      const weekNum = Math.ceil((dayOfYear + jan1.getDay()) / 7);
      return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
    }

    // Check if a VT can be placed this week considering the format
    // collectif: no VT the same week as a journée (same group of people)
    // individuel or mixte: VT can coexist with journée (different people)
    function canPlaceVTInWeek(dateStr: string): boolean {
      if (planFormat === "collectif") {
        const wk = getWeekKey(dateStr);
        return bookedWeeks.get(wk) !== "journee";
      }
      return true; // individuel or mixte: always OK
    }

    function canPlaceJourneeInWeek(dateStr: string): boolean {
      if (planFormat === "collectif") {
        const wk = getWeekKey(dateStr);
        return bookedWeeks.get(wk) !== "vt";
      }
      return true;
    }

    // Build preferred time slots
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

    const preferredSlots = buildPreferredSlots(vtTimeSlot);
    const allDaySlots: string[] = [];
    for (let h = 8; h <= 17; h++) {
      for (const m of ["00", "30"]) allDaySlots.push(`${String(h).padStart(2, "0")}:${m}`);
    }

    // Helper: get all available days in a week window starting from a given date
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

    // Try to find a slot for a session on a specific date with a trainer
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
      return !isConflicting(date, "09:00", 8, trainer.busyEvents);
    }

    // Flexible session finder: tries the target date first, then nearby days in the same window
    function findSlotFlexible(
      windowStart: Date, windowDays: number, sessionType: "vt" | "journee",
      duration: number, availDays: string[]
    ): ProposedSession | null {
      const candidateDays = getAvailableDaysInWindow(windowStart, windowDays, availDays);

      // For each trainer (priority order), try each candidate day
      for (const trainer of trainersWithBusy) {
        for (const date of candidateDays) {
          // Never put two different session types on the same day
          const hasJournee = proposedSessions.some(s => s.session_date === date && s.session_type === "journee");
          const hasVT = proposedSessions.some(s => s.session_date === date && s.session_type === "vt");
          if (sessionType === "journee" && hasVT) continue;
          if (sessionType === "vt" && hasJournee) continue;

          // Collectif format: no VT same week as journée (same group of people)
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
                session_type: "journee", session_date: date, session_time: "09:00",
                duration_hours: 8, trainer_name: trainer.firstName,
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

    // Generate VT sessions with flexible dates
    const vtTotal = parseInt(vtCount) || 0;
    const vtDur = parseFloat(vtDuration) || 1;
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

    // Generate journée sessions with flexible dates
    const jourTotal = parseInt(daysCount) || 0;
    if (jourTotal > 0) {
      const cursor = new Date(rangeStart);
      let placed = 0;
      while (cursor <= rangeEnd && placed < jourTotal) {
        const session = findSlotFlexible(cursor, Math.min(journeeInterval, 14), "journee", 8, clientAvailableDays);
        if (session) {
          proposedSessions.push(session);
          bookedDates.add(session.session_date);
          bookedWeeks.set(getWeekKey(session.session_date), "journee");
          placed++;
        }
        cursor.setDate(cursor.getDate() + journeeInterval);
      }
    }

    // Sort all sessions by date
    proposedSessions.sort((a, b) => a.session_date.localeCompare(b.session_date));

    // Add warnings for trainers without calendars
    for (const t of trainersWithBusy) {
      if (!t.hasCalendar) {
        warnings.push(`${t.name} : pas de Google Calendar lié — disponibilité non vérifiable`);
      }
    }

    // Step D: AI optimization — Claude reviews the planning and suggests improvements
    let aiRecommendation = "";
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const planSummary = proposedSessions.map(s =>
        `${s.session_date} | ${s.session_type === "vt" ? "VT" : "Journée"} | ${s.session_time} | ${s.duration_hours}h | ${s.trainer_name}${s.warning ? " ⚠️ " + s.warning : ""}`
      ).join("\n");

      const trainersInfo = trainersWithBusy.map(t =>
        `${t.name} (score: ${t.score}/3, TJM: ${t.tjm}€, expertise: ${t.hasExpertise ? "oui" : "non"}, même région: ${t.sameRegion ? "oui" : "non"}, calendrier: ${t.hasCalendar ? "lié" : "non lié"})`
      ).join("\n");

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system: `Tu es un assistant de planification de formations. Tu analyses un planning généré automatiquement et donnes une recommandation concise en français (3-5 phrases max). Identifie les points forts et les points d'attention (répartition, charge formateur, continuité pédagogique).`,
        messages: [{
          role: "user",
          content: `Voici le planning généré pour un client :
Format : ${planFormat} (${planFormat === "collectif" ? "pas de VT la même semaine qu'une journée car même groupe" : planFormat === "individuel" ? "VT individuelles peuvent coexister avec journées groupe" : "mixte"})
Jours dispo client : ${clientAvailableDays.join(", ") || "tous"}
Rythme VT : ${vtRhythm} | Rythme Journées : ${journeeRhythm || "N/A"}
Période : ${startDate} → ${endDate}

Experts candidats :
${trainersInfo}

Planning proposé :
${planSummary}

${warnings.length > 0 ? "Alertes : " + warnings.join(", ") : ""}

Analyse ce planning et donne une recommandation courte.`,
        }],
      });
      aiRecommendation = response.content[0].type === "text" ? response.content[0].text : "";
    } catch {
      // AI optimization is optional, continue without it
    }

    // Compute availability percentage for primary trainer
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
      aiRecommendation,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
