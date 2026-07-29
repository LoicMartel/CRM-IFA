/**
 * Fiscal year utilities — shared across the entire CRM.
 * The fiscal mode is stored in crm_settings (key: 'fiscal_year_mode').
 * Two modes: "jan-dec" (January→December) and "sep-aug" (September→August).
 *
 * Legacy functions (getCurrentFiscalYearStart, etc.) default to "sep-aug"
 * for backward compatibility. New code should pass mode explicitly.
 */

export type FiscalMode = "jan-dec" | "sep-aug";

// ── Mode-aware helpers ──────────────────────────────────────────────

function getStartMonthIndex(mode: FiscalMode): number {
  return mode === "jan-dec" ? 0 : 8; // 0=Jan, 8=Sep
}

/** Returns the start year of the current fiscal year for a given mode. */
export function getCurrentFiscalYearStart(mode: FiscalMode = "sep-aug"): number {
  const now = new Date();
  const startMonth = getStartMonthIndex(mode);
  return now.getMonth() >= startMonth ? now.getFullYear() : now.getFullYear() - 1;
}

/** Returns the 12 fiscal month keys in order (e.g. ["01","02",...,"12"] or ["09","10",...,"08"]). */
function getFiscalMonthKeys(mode: FiscalMode): string[] {
  const startMonth = getStartMonthIndex(mode);
  return Array.from({ length: 12 }, (_, i) => {
    const m = ((startMonth + i) % 12) + 1;
    return String(m).padStart(2, "0");
  });
}

/** Returns the 12 months of a fiscal year as date strings ("YYYY-MM-01"). */
export function getFiscalMonths(mode: FiscalMode): string[] {
  const now = new Date();
  const startMonth = getStartMonthIndex(mode);
  const startYear = now.getMonth() >= startMonth ? now.getFullYear() : now.getFullYear() - 1;
  return Array.from({ length: 12 }, (_, i) => {
    const m = startMonth + i;
    const year = startYear + Math.floor(m / 12);
    const month = (m % 12) + 1; // 1-indexed
    return `${year}-${String(month).padStart(2, "0")}-01`;
  });
}

/** Returns the fiscal year date range { start, end } as date strings. */
export function getFiscalRange(mode: FiscalMode): { start: string; end: string } {
  const months = getFiscalMonths(mode);
  const last = months[11]; // "YYYY-MM-01"
  const [y, m] = last.split("-").map(Number);
  // Last day of the last month
  const lastDay = new Date(y, m, 0).getDate(); // m is already 1-indexed, Date(y, m, 0) = last day of month m
  return { start: months[0], end: `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}` };
}

/** Returns { from, to } for a given fiscal year start year. */
export function getFiscalYearRange(fyStart: number, mode: FiscalMode = "sep-aug"): { from: string; to: string } {
  const startMonth = getStartMonthIndex(mode) + 1; // 1-indexed
  const endMonth = ((startMonth - 1 + 11) % 12) + 1; // 12th month, 1-indexed
  const endYear = startMonth > 1 ? fyStart + 1 : fyStart; // crosses year boundary for sep-aug
  const lastDay = new Date(endYear, endMonth, 0).getDate();
  return {
    from: `${fyStart}-${String(startMonth).padStart(2, "0")}-01`,
    to: `${endYear}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

/** Returns the date range for the current fiscal year. */
export function getCurrentFiscalYearRange(mode: FiscalMode = "sep-aug"): { from: string; to: string } {
  return getFiscalYearRange(getCurrentFiscalYearStart(mode), mode);
}

/** Returns a display label like "2025/2026" or "2026". */
export function getFiscalYearLabel(fyStart: number, mode: FiscalMode = "sep-aug"): string {
  if (mode === "jan-dec") return String(fyStart);
  return `${fyStart}/${fyStart + 1}`;
}

/** Returns a database-compatible key like "2025-2026" or "2026". */
export function getFiscalYearKey(fyStart: number, mode: FiscalMode = "sep-aug"): string {
  if (mode === "jan-dec") return String(fyStart);
  return `${fyStart}-${fyStart + 1}`;
}

/** Returns the fiscal year key for a given month string. */
export function getFiscalYearKeyForMonth(month: string, mode: FiscalMode = "sep-aug"): string {
  const [y, m] = month.split("-").map(Number);
  const startMonth = getStartMonthIndex(mode) + 1; // 1-indexed
  const startYear = m >= startMonth ? y : y - 1;
  return getFiscalYearKey(startYear, mode);
}

/** Returns the first day of the current fiscal year. */
export function getDefaultCustomFrom(mode: FiscalMode = "sep-aug"): string {
  return getFiscalYearRange(getCurrentFiscalYearStart(mode), mode).from;
}

/** Checks if a date string falls within a given fiscal year. */
export function isInFiscalYear(dateStr: string, fyStart: number, mode: FiscalMode = "sep-aug"): boolean {
  const { from, to } = getFiscalYearRange(fyStart, mode);
  return dateStr >= from && dateStr <= to;
}

/** Generates fiscal year selector options. */
export function getFiscalYearOptions(count = 4, mode: FiscalMode = "sep-aug"): { value: string; label: string; startYear: number }[] {
  const current = getCurrentFiscalYearStart(mode);
  const offset = Math.floor(count / 2) - 1;
  return Array.from({ length: count }, (_, i) => {
    const fy = current - offset + i;
    return { value: getFiscalYearKey(fy, mode), label: getFiscalYearLabel(fy, mode), startYear: fy };
  });
}

// ── Month labels ──────────────────────────────────────────────────

const MONTH_LABELS_SHORT: Record<string, string> = {
  "01": "janv.", "02": "févr.", "03": "mars", "04": "avr.",
  "05": "mai", "06": "juin", "07": "juil.", "08": "août",
  "09": "sept.", "10": "oct.", "11": "nov.", "12": "déc.",
};

const MONTH_LABELS_FULL: Record<string, string> = {
  "01": "Janvier", "02": "Février", "03": "Mars", "04": "Avril",
  "05": "Mai", "06": "Juin", "07": "Juillet", "08": "Août",
  "09": "Septembre", "10": "Octobre", "11": "Novembre", "12": "Décembre",
};

/** Returns 12 fiscal months as date strings for a given FY start year. */
export function getFiscalMonthDates(fyKeyOrStart: string | number, mode: FiscalMode = "sep-aug"): string[] {
  const startYear = typeof fyKeyOrStart === "number" ? fyKeyOrStart : parseInt(fyKeyOrStart.split("-")[0], 10);
  const startMonthIdx = getStartMonthIndex(mode);
  return Array.from({ length: 12 }, (_, i) => {
    const m = startMonthIdx + i;
    const year = startYear + Math.floor(m / 12);
    const month = (m % 12) + 1;
    return `${year}-${String(month).padStart(2, "0")}-01`;
  });
}

/** Returns 12 fiscal months with short labels. */
export function getFiscalMonthsWithLabels(fyKeyOrStart: string | number, mode: FiscalMode = "sep-aug"): { key: string; label: string; date: string }[] {
  const dates = getFiscalMonthDates(fyKeyOrStart, mode);
  return dates.map((d) => {
    const m = d.slice(5, 7);
    const yr = d.slice(0, 4);
    return { key: m, label: `${MONTH_LABELS_SHORT[m]} ${yr.slice(-2)}`, date: d };
  });
}

/** Returns 12 fiscal months with full labels. */
export function getFiscalMonthsFull(fyKeyOrStart: string | number, mode: FiscalMode = "sep-aug"): { key: string; label: string; date: string }[] {
  const dates = getFiscalMonthDates(fyKeyOrStart, mode);
  return dates.map((d) => {
    const m = d.slice(5, 7);
    const yr = d.slice(0, 4);
    return { key: m, label: `${MONTH_LABELS_FULL[m]} ${yr}`, date: d };
  });
}
