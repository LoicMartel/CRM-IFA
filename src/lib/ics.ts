/**
 * Generate an .ics calendar file content
 */
export function generateICS({
  summary,
  description,
  location,
  startDateTime,
  endDateTime,
  organizerName,
  organizerEmail,
}: {
  summary: string;
  description: string;
  location?: string;
  startDateTime: string; // ISO or "YYYY-MM-DDTHH:mm:ss"
  endDateTime: string;
  organizerName?: string;
  organizerEmail?: string;
}): string {
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@closing-academie.com`;
  const now = formatICSDate(new Date().toISOString());
  const dtStart = formatICSDate(startDateTime);
  const dtEnd = formatICSDate(endDateTime);

  const escapedSummary = escapeICS(summary);
  const escapedDesc = escapeICS(description);
  const escapedLocation = location ? escapeICS(location) : "";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//La Closing Académie//CRM//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=Europe/Paris:${dtStart}`,
    `DTEND;TZID=Europe/Paris:${dtEnd}`,
    `SUMMARY:${escapedSummary}`,
    `DESCRIPTION:${escapedDesc}`,
  ];

  if (escapedLocation) lines.push(`LOCATION:${escapedLocation}`);
  if (organizerName && organizerEmail) {
    lines.push(`ORGANIZER;CN=${escapeICS(organizerName)}:mailto:${organizerEmail}`);
  }

  lines.push(
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Rappel",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  );

  return lines.join("\r\n");
}

function formatICSDate(dateStr: string): string {
  // Convert "2026-04-02T09:00:00" or ISO to "20260402T090000"
  const clean = dateStr.replace(/[-:]/g, "").replace(/\.\d+/, "").split("+")[0].split("Z")[0];
  // Ensure format YYYYMMDDTHHMMSS
  if (clean.includes("T")) return clean.slice(0, 15);
  return clean + "T000000";
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}
