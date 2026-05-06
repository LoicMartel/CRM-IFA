/**
 * French public holidays (jours feries).
 * Includes both fixed-date and Easter-based movable holidays.
 */

/** Compute Easter Sunday for a given year (anonymous Gregorian algorithm). */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Returns a Set of "YYYY-MM-DD" strings for all French public holidays in the given year. */
export function getFrenchHolidays(year: number): Set<string> {
  const easter = easterSunday(year);

  return new Set([
    `${year}-01-01`, // Jour de l'An
    toDateStr(addDays(easter, 1)),  // Lundi de Paques
    `${year}-05-01`, // Fete du Travail
    `${year}-05-08`, // Victoire 1945
    toDateStr(addDays(easter, 39)), // Ascension
    toDateStr(addDays(easter, 50)), // Lundi de Pentecote
    `${year}-07-14`, // Fete Nationale
    `${year}-08-15`, // Assomption
    `${year}-11-01`, // Toussaint
    `${year}-11-11`, // Armistice
    `${year}-12-25`, // Noel
  ]);
}

/** Check if a "YYYY-MM-DD" date string is a French public holiday. */
export function isFrenchHoliday(dateStr: string): boolean {
  const year = parseInt(dateStr.slice(0, 4), 10);
  return getFrenchHolidays(year).has(dateStr);
}
