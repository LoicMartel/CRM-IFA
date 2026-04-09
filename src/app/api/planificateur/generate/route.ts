import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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
      expertise, city, budget,
      clientAvailableDays, vtRhythm, vtTimeSlot, vtDuration,
      journeeRhythm, journeeLocation,
      startDate, endDate, vtCount, daysCount,
    } = body;

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

    // Step C: Generate schedule
    const proposedSessions: ProposedSession[] = [];
    const warnings: string[] = [];

    // Build preferred time slots from vtTimeSlot (can be "09:00" or "09:00-12:00" or "09:00,10:00,14:00")
    function buildPreferredSlots(vtTimeSlot: string): string[] {
      if (!vtTimeSlot) return ["09:00", "09:30", "10:00", "10:30", "11:00", "14:00", "14:30", "15:00", "15:30", "16:00"];
      // Range format: "09:00-12:00"
      if (vtTimeSlot.includes("-")) {
        const [startStr, endStr] = vtTimeSlot.split("-").map((s: string) => s.trim());
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
      // Comma-separated: "09:00,10:00,14:00"
      if (vtTimeSlot.includes(",")) {
        return vtTimeSlot.split(",").map((s: string) => s.trim()).filter(Boolean);
      }
      // Single time: "10:00"
      return [vtTimeSlot];
    }

    const preferredSlots = buildPreferredSlots(vtTimeSlot);

    // All possible slots from 08:00 to 18:00 (fallback)
    const allDaySlots: string[] = [];
    for (let h = 8; h <= 17; h++) {
      for (const m of ["00", "30"]) {
        allDaySlots.push(`${String(h).padStart(2, "0")}:${m}`);
      }
    }

    // Generate VT dates
    if ((parseInt(vtCount) || 0) > 0) {
      const vtDates = generateCandidateDates(startDate, endDate, vtRhythm, clientAvailableDays, parseInt(vtCount));
      const duration = parseFloat(vtDuration) || 1;

      for (const date of vtDates) {
        let assigned = false;

        // Priority 1: Try preferred slots with trainer #1 (best scored)
        // Priority 2: Try preferred slots with trainer #2, #3
        // Priority 3: Try ALL slots with trainer #1
        // Priority 4: Try ALL slots with trainer #2, #3
        for (const trainer of trainersWithBusy) {
          for (const slot of preferredSlots) {
            if (!isConflicting(date, slot, duration, trainer.busyEvents)) {
              const isAlternative = trainer !== trainersWithBusy[0];
              proposedSessions.push({
                session_type: "vt",
                session_date: date,
                session_time: slot,
                duration_hours: duration,
                trainer_name: trainer.firstName,
                session_location: null,
                warning: isAlternative ? `${trainersWithBusy[0].firstName} indisponible` : undefined,
              });
              if (isAlternative) {
                warnings.push(`${date} (VT) : ${trainersWithBusy[0].firstName} indisponible → ${trainer.firstName} assigné`);
              }
              assigned = true;
              break;
            }
          }
          if (assigned) break;
        }

        // Fallback: try all day slots with each trainer
        if (!assigned) {
          for (const trainer of trainersWithBusy) {
            for (const slot of allDaySlots) {
              if (!isConflicting(date, slot, duration, trainer.busyEvents)) {
                const isAlternative = trainer !== trainersWithBusy[0];
                const warning = isAlternative
                  ? `Créneau alternatif ${slot} — ${trainersWithBusy[0].firstName} indisponible`
                  : `Créneau alternatif (${slot})`;
                proposedSessions.push({
                  session_type: "vt",
                  session_date: date,
                  session_time: slot,
                  duration_hours: duration,
                  trainer_name: trainer.firstName,
                  session_location: null,
                  warning,
                });
                warnings.push(`${date} (VT) : créneau ${slot} avec ${trainer.firstName}`);
                assigned = true;
                break;
              }
            }
            if (assigned) break;
          }
        }

        if (!assigned) {
          proposedSessions.push({
            session_type: "vt",
            session_date: date,
            session_time: preferredSlots[0] || "09:00",
            duration_hours: duration,
            trainer_name: trainersWithBusy[0].firstName,
            session_location: null,
            warning: "Aucun expert disponible — assignation manuelle nécessaire",
          });
          warnings.push(`${date} (VT) : aucun expert disponible`);
        }
      }
    }

    // Generate journée dates
    if ((parseInt(daysCount) || 0) > 0) {
      const journeeDates = generateCandidateDates(startDate, endDate, journeeRhythm || "1x/mois", clientAvailableDays, parseInt(daysCount));

      for (const date of journeeDates) {
        let assigned = false;
        for (const trainer of trainersWithBusy) {
          if (!isConflicting(date, "09:00", 8, trainer.busyEvents)) {
            const isAlternative = trainer !== trainersWithBusy[0];
            proposedSessions.push({
              session_type: "journee",
              session_date: date,
              session_time: "09:00",
              duration_hours: 8,
              trainer_name: trainer.firstName,
              session_location: journeeLocation || null,
              warning: isAlternative ? `${trainersWithBusy[0].firstName} indisponible` : undefined,
            });
            if (isAlternative) {
              warnings.push(`${date} (Journée) : ${trainersWithBusy[0].firstName} indisponible → ${trainer.firstName} assigné`);
            }
            assigned = true;
            break;
          }
        }
        if (!assigned) {
          proposedSessions.push({
            session_type: "journee",
            session_date: date,
            session_time: "09:00",
            duration_hours: 8,
            trainer_name: trainersWithBusy[0].firstName,
            session_location: journeeLocation || null,
            warning: "Aucun expert disponible — assignation manuelle nécessaire",
          });
          warnings.push(`${date} (Journée) : aucun expert disponible`);
        }
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
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
