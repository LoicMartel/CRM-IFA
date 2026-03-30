import * as XLSX from "xlsx";
import { splitName } from "@/lib/visioformation";

// ===== Types =====

export interface VisioSessionRow {
  titre: string;
  interIntra: string;
  dateDebut: string;
  dateFin: string;
  heuresPrevues: string;
  heuresRealisees: string;
  apprenants: string;
  entreprise: string;
  formateurs: string;
  statut: string;
  emplacement: string;
  lieuFormation: string;
}

export interface ServicePlanRef {
  id: string;
  company_id: string;
  companies: { name: string; address?: string; city?: string } | null;
}

export interface TeamMemberRef {
  first_name: string;
  last_name: string;
  zoom_link: string | null;
}

export interface LearnerRef {
  id: string;
  first_name: string;
  last_name: string;
}

export interface SessionImportRow {
  raw: VisioSessionRow;
  titre: string;
  dateDebut: string;
  dateFin: string;
  durationHours: number;
  sessionType: "vt" | "journee";
  status: "planned" | "done" | "cancelled";
  trainers: string[];
  entreprise: string;
  servicePlanId: string | null;
  servicePlanLabel: string;
  matchType: "exact" | "partial" | "none";
  apprenantNames: string[];
  matchedLearnerIds: string[];
  nbApprenants: number;
  sessionLocation: string;
}

// ===== Parsing =====

export function parseSessionsExport(buffer: ArrayBuffer): VisioSessionRow[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

  return raw.map((row) => ({
    titre: String(row["Nom de la formation"] ?? "").trim(),
    interIntra: String(row["Inter/Intra/Autre"] ?? "").trim(),
    dateDebut: String(row["Date de début de la formation"] ?? "").trim(),
    dateFin: String(row["Date de fin de la formation"] ?? "").trim(),
    heuresPrevues: String(row["Heures prévues"] ?? "").trim(),
    heuresRealisees: String(row["Heures réalisées"] ?? "").trim(),
    apprenants: String(row["Apprenants"] ?? "").trim(),
    entreprise: String(row["Entreprises"] ?? "").trim(),
    formateurs: String(row["Formateurs"] ?? "").trim(),
    statut: String(row["Statut"] ?? "").trim(),
    emplacement: String(row["Emplacement"] ?? "").trim(),
    lieuFormation: String(row["Lieu de formation"] ?? row["Lieu de la formation"] ?? row["Lieu"] ?? "").trim(),
  })).filter((r) => r.titre);
}

// ===== Utilities =====

export function parseHours(heures: string): number {
  if (!heures) return 0;
  const parts = heures.split(":");
  if (parts.length >= 1) {
    const h = parseInt(parts[0], 10);
    const m = parts.length >= 2 ? parseInt(parts[1], 10) : 0;
    return h + m / 60;
  }
  return 0;
}

export function mapEmplacement(emplacement: string): "vt" | "journee" {
  const lower = emplacement.toLowerCase().trim();
  if (lower === "en présentiel" || lower === "en situation de travail") return "journee";
  // "A Distance", "Mixte", or anything else
  return "vt";
}

export function mapStatus(statut: string): "planned" | "done" | "cancelled" {
  const lower = statut.toLowerCase().trim();
  if (lower === "terminées" || lower === "terminées") return "done";
  // "Planifiés", "En Cours" → planned
  return "planned";
}

export function matchTrainers(formateurs: string): string[] {
  if (!formateurs) return [];
  return formateurs
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean)
    .map((fullName) => {
      const { firstName } = splitName(fullName);
      return firstName || fullName;
    });
}

// ===== Session location resolution =====

export function resolveSessionLocation(
  sessionType: "vt" | "journee",
  lieuFormation: string,
  companyAddress: string,
  trainerFirstNames: string[],
  teamMembers: TeamMemberRef[]
): string {
  if (sessionType === "journee") {
    // Présentiel: lieu de formation > adresse entreprise
    if (lieuFormation) return lieuFormation;
    if (companyAddress) return companyAddress;
    return "";
  }
  // À distance: lien visio du formateur
  if (trainerFirstNames.length > 0) {
    const trainerName = trainerFirstNames[0];
    const member = teamMembers.find(
      (m) => m.first_name.toLowerCase() === trainerName.toLowerCase()
    );
    if (member?.zoom_link) return member.zoom_link;
  }
  return "";
}

// ===== Company → Service Plan matching =====

export function matchSessionToServicePlan(
  entreprise: string,
  servicePlans: ServicePlanRef[]
): { servicePlanId: string | null; servicePlanLabel: string; matchType: "exact" | "partial" | "none" } {
  if (!entreprise) return { servicePlanId: null, servicePlanLabel: "", matchType: "none" };

  const entNorm = entreprise.toLowerCase().trim();

  // Exact match
  const exact = servicePlans.find(
    (sp) => (sp.companies?.name ?? "").toLowerCase().trim() === entNorm
  );
  if (exact) {
    return {
      servicePlanId: exact.id,
      servicePlanLabel: exact.companies?.name ?? "",
      matchType: "exact",
    };
  }

  // Partial match
  const partial = servicePlans.find((sp) => {
    const spName = (sp.companies?.name ?? "").toLowerCase().trim();
    return spName.includes(entNorm) || entNorm.includes(spName);
  });
  if (partial) {
    return {
      servicePlanId: partial.id,
      servicePlanLabel: partial.companies?.name ?? "",
      matchType: "partial",
    };
  }

  return { servicePlanId: null, servicePlanLabel: "", matchType: "none" };
}

// ===== Learner matching by name =====

function normalizeName(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export function matchLearnersByName(
  apprenantsStr: string,
  learners: LearnerRef[]
): { names: string[]; matchedIds: string[] } {
  if (!apprenantsStr) return { names: [], matchedIds: [] };

  const names = apprenantsStr.split(",").map((n) => n.trim()).filter(Boolean);
  const matchedIds: string[] = [];

  for (const rawName of names) {
    const { firstName, lastName } = splitName(rawName);
    const fnNorm = normalizeName(firstName);
    const lnNorm = normalizeName(lastName);

    const match = learners.find((l) => {
      const lFn = normalizeName(l.first_name);
      const lLn = normalizeName(l.last_name);
      // Match either way (first/last or last/first)
      return (lFn === fnNorm && lLn === lnNorm) || (lFn === lnNorm && lLn === fnNorm);
    });

    if (match && !matchedIds.includes(match.id)) {
      matchedIds.push(match.id);
    }
  }

  return { names, matchedIds };
}

// ===== Build session import rows =====

export function buildSessionImportRows(
  visioRows: VisioSessionRow[],
  servicePlans: ServicePlanRef[],
  learners: LearnerRef[],
  teamMembers: TeamMemberRef[] = []
): SessionImportRow[] {
  return visioRows.map((row) => {
    const { servicePlanId, servicePlanLabel, matchType } = matchSessionToServicePlan(
      row.entreprise,
      servicePlans
    );
    const { names, matchedIds } = matchLearnersByName(row.apprenants, learners);
    const durationHours = parseHours(row.heuresPrevues);
    const sessionType = mapEmplacement(row.emplacement);
    const trainers = matchTrainers(row.formateurs);

    // Resolve location
    const matchedPlan = servicePlanId ? servicePlans.find((sp) => sp.id === servicePlanId) : null;
    const companyAddress = matchedPlan?.companies
      ? [matchedPlan.companies.address, matchedPlan.companies.city].filter(Boolean).join(", ")
      : "";

    const sessionLocation = resolveSessionLocation(
      sessionType,
      row.lieuFormation,
      companyAddress,
      trainers,
      teamMembers
    );

    return {
      raw: row,
      titre: row.titre,
      dateDebut: row.dateDebut,
      dateFin: row.dateFin,
      durationHours,
      sessionType,
      status: mapStatus(row.statut),
      trainers,
      entreprise: row.entreprise,
      servicePlanId,
      servicePlanLabel,
      matchType,
      apprenantNames: names,
      matchedLearnerIds: matchedIds,
      nbApprenants: names.length,
      sessionLocation,
    };
  });
}
