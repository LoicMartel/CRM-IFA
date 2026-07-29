/**
 * Fiscal year utilities for IFA Formation.
 * Fiscal year runs September (09) to August (08).
 * Example: FY 2025/2026 = Sept 2025 → Aug 2026.
 */

/** Returns the start year of the current fiscal year. */
export function getCurrentFiscalYearStart(): number {
  const now = new Date();
  return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
}

/** Returns the date range for a given fiscal year. */
export function getFiscalYearRange(fyStart: number): { from: string; to: string } {
  return {
    from: `${fyStart}-09-01`,
    to: `${fyStart + 1}-08-31`,
  };
}

/** Returns the date range for the current fiscal year. */
export function getCurrentFiscalYearRange(): { from: string; to: string } {
  return getFiscalYearRange(getCurrentFiscalYearStart());
}

/** Returns a display label like "2025/2026". */
export function getFiscalYearLabel(fyStart: number): string {
  return `${fyStart}/${fyStart + 1}`;
}

/** Returns a database-compatible key like "2025-2026". */
export function getFiscalYearKey(fyStart: number): string {
  return `${fyStart}-${fyStart + 1}`;
}

/**
 * Returns the fiscal year key ("YYYY-YYYY") for a given month string.
 * @param month A "YYYY-MM" or "YYYY-MM-DD" string. A month >= September (09)
 *              belongs to the fiscal year starting that year; otherwise the previous year.
 */
export function getFiscalYearKeyForMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const startYear = m >= 9 ? y : y - 1;
  return getFiscalYearKey(startYear);
}

/** Returns the first day of the current fiscal year (e.g. "2025-09-01"). */
export function getDefaultCustomFrom(): string {
  return getFiscalYearRange(getCurrentFiscalYearStart()).from;
}

/** Checks if a "YYYY-MM-DD" date string falls within a given fiscal year. */
export function isInFiscalYear(dateStr: string, fyStart: number): boolean {
  const { from, to } = getFiscalYearRange(fyStart);
  return dateStr >= from && dateStr <= to;
}

/**
 * Generates fiscal year selector options.
 * @param count Number of options (default 4). Centered around current FY.
 * @returns Array of { value: "2025-2026", label: "2025/2026", startYear: 2025 }
 */
export function getFiscalYearOptions(count = 4): { value: string; label: string; startYear: number }[] {
  const current = getCurrentFiscalYearStart();
  const offset = Math.floor(count / 2) - 1;
  return Array.from({ length: count }, (_, i) => {
    const fy = current - offset + i;
    return { value: getFiscalYearKey(fy), label: getFiscalYearLabel(fy), startYear: fy };
  });
}

/** Short French month labels for fiscal year display. */
const MONTH_LABELS_SHORT: Record<string, string> = {
  "09": "sept.", "10": "oct.", "11": "nov.", "12": "déc.",
  "01": "janv.", "02": "févr.", "03": "mars", "04": "avr.",
  "05": "mai", "06": "juin", "07": "juil.", "08": "août",
};

const MONTH_LABELS_FULL: Record<string, string> = {
  "09": "Septembre", "10": "Octobre", "11": "Novembre", "12": "Décembre",
  "01": "Janvier", "02": "Février", "03": "Mars", "04": "Avril",
  "05": "Mai", "06": "Juin", "07": "Juillet", "08": "Août",
};

const FISCAL_MONTH_KEYS = ["09", "10", "11", "12", "01", "02", "03", "04", "05", "06", "07", "08"];

/**
 * Returns the 12 fiscal months as date strings ("YYYY-MM-01").
 * @param fyKeyOrStart Either "2025-2026" or 2025
 */
export function getFiscalMonthDates(fyKeyOrStart: string | number): string[] {
  const startYear = typeof fyKeyOrStart === "number" ? fyKeyOrStart : parseInt(fyKeyOrStart.split("-")[0], 10);
  return FISCAL_MONTH_KEYS.map((m) => {
    const yr = parseInt(m, 10) >= 9 ? startYear : startYear + 1;
    return `${yr}-${m}-01`;
  });
}

/**
 * Returns the 12 fiscal months with short labels.
 * @param fyKeyOrStart Either "2025-2026" or 2025
 */
export function getFiscalMonthsWithLabels(fyKeyOrStart: string | number): { key: string; label: string; date: string }[] {
  const startYear = typeof fyKeyOrStart === "number" ? fyKeyOrStart : parseInt(fyKeyOrStart.split("-")[0], 10);
  return FISCAL_MONTH_KEYS.map((m) => {
    const yr = parseInt(m, 10) >= 9 ? startYear : startYear + 1;
    const shortYear = String(yr).slice(-2);
    return {
      key: m,
      label: `${MONTH_LABELS_SHORT[m]} ${shortYear}`,
      date: `${yr}-${m}-01`,
    };
  });
}

/**
 * Returns the 12 fiscal months with full labels (e.g. "Septembre 2025").
 * @param fyKeyOrStart Either "2025-2026" or 2025
 */
export function getFiscalMonthsFull(fyKeyOrStart: string | number): { key: string; label: string; date: string }[] {
  const startYear = typeof fyKeyOrStart === "number" ? fyKeyOrStart : parseInt(fyKeyOrStart.split("-")[0], 10);
  return FISCAL_MONTH_KEYS.map((m) => {
    const yr = parseInt(m, 10) >= 9 ? startYear : startYear + 1;
    return {
      key: m,
      label: `${MONTH_LABELS_FULL[m]} ${yr}`,
      date: `${yr}-${m}-01`,
    };
  });
}
