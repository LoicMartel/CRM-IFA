import * as XLSX from "xlsx";

// ===== Types =====

export interface VisioPlanRow {
  titre: string;
  interIntra: string;
  dateDebut: string;
  dateFin: string;
  heuresPrevues: string;
  apprenants: string;
  entreprise: string;
  formateurs: string;
  statut: string;
  emplacement: string;
}

export interface CompanyRefPlan {
  id: string;
  name: string;
}

export interface LearnerRefPlan {
  id: string;
  first_name: string;
  last_name: string;
  company_id: string | null;
}

export interface PlanImportRow {
  entreprise: string;
  companyId: string | null;
  companyName: string;
  matchType: "exact" | "partial" | "none";
  learnerNames: string[];
  matchedLearnerIds: string[];
  sessionCount: number;
  vtCount: number;
  journeeCount: number;
  totalHours: number;
  startDate: string | null;
  endDate: string | null;
  mode: "presentiel" | "distanciel" | "mixte";
  format: "individuel" | "collectif";
  formateurs: string[];
}

// ===== Parsing =====

export function parsePlansExport(buffer: ArrayBuffer): VisioPlanRow[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

  return raw.map((row) => ({
    titre: String(row["Nom de la formation"] ?? "").trim(),
    interIntra: String(row["Inter/Intra/Autre"] ?? "").trim(),
    dateDebut: String(row["Date de début de la formation"] ?? "").trim(),
    dateFin: String(row["Date de fin de la formation"] ?? "").trim(),
    heuresPrevues: String(row["Heures prévues"] ?? "").trim(),
    apprenants: String(row["Apprenants"] ?? "").trim(),
    entreprise: String(row["Entreprises"] ?? "").trim(),
    formateurs: String(row["Formateurs"] ?? "").trim(),
    statut: String(row["Statut"] ?? "").trim(),
    emplacement: String(row["Emplacement"] ?? "").trim(),
  })).filter((r) => r.titre);
}

// ===== Utilities =====

function parseHours(heures: string): number {
  if (!heures) return 0;
  const parts = heures.split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parts.length >= 2 ? parseInt(parts[1], 10) || 0 : 0;
  return h + m / 60;
}

function isJournee(emplacement: string, durationHours: number): boolean {
  if (durationHours >= 7) return true;
  const lower = emplacement.toLowerCase().trim();
  return lower === "en présentiel" || lower === "en situation de travail";
}

function normalizeName(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function splitName(nom: string): { firstName: string; lastName: string } {
  const parts = nom.trim().split(/\s+/);
  if (parts.length <= 1) return { firstName: parts[0] || "", lastName: "" };
  const firstIsUpper = parts[0] === parts[0].toUpperCase() && parts[0].length > 1;
  const lastIsUpper = parts[parts.length - 1] === parts[parts.length - 1].toUpperCase() && parts[parts.length - 1].length > 1;
  if (firstIsUpper && !lastIsUpper) {
    let splitIdx = 1;
    for (let i = 1; i < parts.length; i++) {
      if (parts[i] === parts[i].toUpperCase() && parts[i].length > 1) splitIdx = i + 1;
      else break;
    }
    return { firstName: parts.slice(splitIdx).join(" "), lastName: parts.slice(0, splitIdx).join(" ") };
  }
  if (lastIsUpper) {
    let splitIdx = parts.length - 1;
    for (let i = parts.length - 1; i >= 1; i--) {
      if (parts[i] === parts[i].toUpperCase() && parts[i].length > 1) splitIdx = i;
      else break;
    }
    return { firstName: parts.slice(0, splitIdx).join(" "), lastName: parts.slice(splitIdx).join(" ") };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

// ===== Company matching =====

function matchCompanyForPlan(
  entreprise: string,
  companies: CompanyRefPlan[]
): { companyId: string | null; companyName: string; matchType: "exact" | "partial" | "none" } {
  if (!entreprise) return { companyId: null, companyName: "", matchType: "none" };
  const entNorm = entreprise.toLowerCase().trim();

  const exact = companies.find((c) => c.name.toLowerCase().trim() === entNorm);
  if (exact) return { companyId: exact.id, companyName: exact.name, matchType: "exact" };

  const partial = companies.find((c) => {
    const cn = c.name.toLowerCase().trim();
    return cn.includes(entNorm) || entNorm.includes(cn);
  });
  if (partial) return { companyId: partial.id, companyName: partial.name, matchType: "partial" };

  return { companyId: null, companyName: entreprise, matchType: "none" };
}

// ===== Learner matching =====

function matchLearners(
  apprenantsStr: string,
  learners: LearnerRefPlan[]
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
      return (lFn === fnNorm && lLn === lnNorm) || (lFn === lnNorm && lLn === fnNorm);
    });

    if (match && !matchedIds.includes(match.id)) {
      matchedIds.push(match.id);
    }
  }

  return { names, matchedIds };
}

// ===== Parse date string to ISO =====

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  // Try DD/MM/YYYY
  const dmy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  return null;
}

// ===== Build plan import rows (grouped by entreprise) =====

export function buildPlanImportRows(
  visioRows: VisioPlanRow[],
  companies: CompanyRefPlan[],
  learners: LearnerRefPlan[]
): PlanImportRow[] {
  // Group rows by entreprise
  const groups = new Map<string, VisioPlanRow[]>();
  for (const row of visioRows) {
    const key = row.entreprise.toLowerCase().trim();
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const results: PlanImportRow[] = [];

  for (const [, rows] of groups) {
    const firstRow = rows[0];
    const { companyId, companyName, matchType } = matchCompanyForPlan(firstRow.entreprise, companies);

    // Aggregate all unique learner names across all sessions for this company
    const allLearnerNames = new Set<string>();
    for (const r of rows) {
      if (r.apprenants) {
        r.apprenants.split(",").map((n) => n.trim()).filter(Boolean).forEach((n) => allLearnerNames.add(n));
      }
    }
    const { names: learnerNames, matchedIds: matchedLearnerIds } = matchLearners(
      Array.from(allLearnerNames).join(", "),
      learners
    );

    // Count session types
    let vtCount = 0;
    let journeeCount = 0;
    let totalHours = 0;
    const allFormateurs = new Set<string>();
    const allDates: string[] = [];

    for (const r of rows) {
      const hours = parseHours(r.heuresPrevues);
      totalHours += hours;
      if (isJournee(r.emplacement, hours)) journeeCount++;
      else vtCount++;

      if (r.formateurs) {
        r.formateurs.split(",").map((f) => f.trim()).filter(Boolean).forEach((f) => {
          const { firstName } = splitName(f);
          allFormateurs.add(firstName || f);
        });
      }

      const d1 = parseDate(r.dateDebut);
      const d2 = parseDate(r.dateFin);
      if (d1) allDates.push(d1);
      if (d2) allDates.push(d2);
    }

    allDates.sort();
    const startDate = allDates.length > 0 ? allDates[0] : null;
    const endDate = allDates.length > 0 ? allDates[allDates.length - 1] : null;

    // Determine mode
    let mode: "presentiel" | "distanciel" | "mixte" = "distanciel";
    if (journeeCount > 0 && vtCount > 0) mode = "mixte";
    else if (journeeCount > 0) mode = "presentiel";

    // Format
    const uniqueLearnerCount = allLearnerNames.size;
    const format: "individuel" | "collectif" = uniqueLearnerCount > 1 ? "collectif" : "individuel";

    results.push({
      entreprise: firstRow.entreprise,
      companyId,
      companyName,
      matchType,
      learnerNames,
      matchedLearnerIds,
      sessionCount: rows.length,
      vtCount,
      journeeCount,
      totalHours: Math.round(totalHours * 10) / 10,
      startDate,
      endDate,
      mode,
      format,
      formateurs: Array.from(allFormateurs),
    });
  }

  // Sort by company name
  results.sort((a, b) => a.entreprise.localeCompare(b.entreprise));

  return results;
}
