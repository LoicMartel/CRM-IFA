const TZ = "Europe/Paris";

/**
 * Convert any date/datetime string to Paris-local date (YYYY-MM-DD) and time (HH:MM).
 * Handles UTC ISO strings, offset strings, and naive datetime strings.
 */
export function toParisDateTime(dateStr: string): { date: string; time: string } {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    // Fallback: extract directly from string
    return {
      date: dateStr.slice(0, 10),
      time: dateStr.includes("T") ? dateStr.slice(11, 16) : "00:00",
    };
  }
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

/**
 * Get the current UTC offset for Europe/Paris at a given date.
 * Returns "+01:00" (winter/CET) or "+02:00" (summer/CEST).
 */
export function getParisOffset(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  if (isNaN(d.getTime())) return "+01:00";

  // Get the offset by comparing UTC time with Paris local time
  const utc = d.getTime();
  const parisStr = d.toLocaleString("sv-SE", { timeZone: TZ });
  const paris = new Date(parisStr + "Z").getTime();
  const offsetMinutes = (paris - utc) / 60000;
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absMinutes = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absMinutes / 60)).padStart(2, "0");
  const minutes = String(absMinutes % 60).padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

export { TZ };
