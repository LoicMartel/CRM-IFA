/**
 * Europe/Paris VTIMEZONE (CET/CEST) — required by RFC 5545 when using TZID
 */
const VTIMEZONE_PARIS = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Paris",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10",
  "END:STANDARD",
  "END:VTIMEZONE",
].join("\r\n");

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
  attendeeEmail,
  attendeeName,
}: {
  summary: string;
  description: string;
  location?: string;
  startDateTime: string; // ISO or "YYYY-MM-DDTHH:mm:ss"
  endDateTime: string;
  organizerName?: string;
  organizerEmail?: string;
  attendeeEmail?: string;
  attendeeName?: string;
}): string {
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@ifagroupe.com`;
  const now = formatICSDate(new Date().toISOString());
  const dtStart = formatICSDate(startDateTime);
  const dtEnd = formatICSDate(endDateTime);

  const escapedSummary = escapeICS(summary);
  const escapedDesc = escapeICS(description);
  const escapedLocation = location ? escapeICS(location) : "";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//IFA Formatio//CRM//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    VTIMEZONE_PARIS,
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=Europe/Paris:${dtStart}`,
    `DTEND;TZID=Europe/Paris:${dtEnd}`,
    `SUMMARY:${escapedSummary}`,
    `DESCRIPTION:${escapedDesc}`,
    "STATUS:CONFIRMED",
  ];

  if (escapedLocation) lines.push(`LOCATION:${escapedLocation}`);
  if (organizerName && organizerEmail) {
    lines.push(`ORGANIZER;CN=${escapeICS(organizerName)}:mailto:${organizerEmail}`);
  }
  if (attendeeEmail) {
    const cn = attendeeName ? `;CN=${escapeICS(attendeeName)}` : "";
    lines.push(`ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE${cn}:mailto:${attendeeEmail}`);
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
