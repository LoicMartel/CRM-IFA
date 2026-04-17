/**
 * Email templates for prospect meeting confirmations.
 * Tone: pro-chaleureux, tutoiement, style La Closing Academie.
 */

interface ProspectEmailParams {
  contactFirstName: string;
  meetingType: string;
  dateDisplay: string;
  timeStr: string;
  durationLabel: string;
  modeLabel: string;
  zoomLink?: string;
  location?: string;
  managerNames: string[]; // All account manager names for this meeting
}

function buildInfoBlock(p: ProspectEmailParams): string {
  const lines: string[] = [
    `\ud83d\udcc6 ${p.dateDisplay} \u00e0 ${p.timeStr} (${p.durationLabel})`,
    `\ud83d\udda5\ufe0f ${p.modeLabel}`,
  ];
  if (p.zoomLink) lines.push(`\ud83d\udd17 Lien Zoom : ${p.zoomLink}`);
  if (p.location) lines.push(`\ud83d\udccd Lieu : ${p.location}`);
  if (p.managerNames.length > 0) {
    lines.push(`\ud83d\udc64 Avec : ${p.managerNames.join(", ")}`);
  }
  return lines.join("\n");
}

const introByType: Record<string, (name: string) => string> = {
  R0: (name) => [
    `Bonjour ${name},`,
    "",
    "Suite \u00e0 notre \u00e9change, un premier appel est planifi\u00e9 pour mieux comprendre ta situation et tes enjeux.",
    "",
    "Voici les d\u00e9tails :",
  ].join("\n"),

  "R0+R1": (name) => [
    `Bonjour ${name},`,
    "",
    "Ton rendez-vous de d\u00e9couverte est confirm\u00e9. On prendra le temps de comprendre ton contexte et d'identifier ensemble les meilleures pistes d'accompagnement.",
    "",
    "Voici les d\u00e9tails :",
  ].join("\n"),

  R1: (name) => [
    `Bonjour ${name},`,
    "",
    "H\u00e2te de te retrouver pour notre rendez-vous d\u00e9couverte ! Ce sera l'occasion d'explorer ensemble tes besoins et de comprendre comment on peut t'accompagner au mieux.",
    "",
    "Voici les d\u00e9tails :",
  ].join("\n"),

  R2: (name) => [
    `Bonjour ${name},`,
    "",
    "Ton rendez-vous est confirm\u00e9. On te pr\u00e9sentera une solution adapt\u00e9e \u00e0 tes besoins, bas\u00e9e sur nos \u00e9changes pr\u00e9c\u00e9dents.",
    "",
    "Voici les d\u00e9tails :",
  ].join("\n"),

  R3: (name) => [
    `Bonjour ${name},`,
    "",
    "Ton rendez-vous de finalisation est confirm\u00e9. On abordera ensemble les derniers d\u00e9tails pour concr\u00e9tiser notre collaboration.",
    "",
    "Voici les d\u00e9tails :",
  ].join("\n"),
};

export function getProspectEmailBody(p: ProspectEmailParams): string {
  const introFn = introByType[p.meetingType] ?? introByType["R1"];
  const intro = introFn(p.contactFirstName);
  const info = buildInfoBlock(p);

  return [
    intro,
    "",
    info,
    "",
    "Tu trouveras en pi\u00e8ce jointe une invitation calendrier (.ics) \u00e0 ajouter \u00e0 ton agenda.",
    "",
    "\u00c0 tr\u00e8s bient\u00f4t,",
    "",
    "L'\u00e9quipe La Closing Acad\u00e9mie",
  ].join("\n");
}

export function getProspectEmailSubject(meetingType: string, contactName: string, companyName?: string): string {
  const suffix = companyName ? ` (${companyName})` : "";
  const labels: Record<string, string> = {
    R0: "Premier \u00e9change",
    "R0+R1": "D\u00e9couverte",
    R1: "D\u00e9couverte",
    R2: "Pr\u00e9sentation solution",
    R3: "Finalisation",
  };
  const label = labels[meetingType] ?? meetingType;
  return `${label} \u2014 ${contactName}${suffix}`;
}
