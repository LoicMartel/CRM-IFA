/**
 * Email templates for prospect meeting confirmations.
 * Tone: pro-chaleureux, vouvoiement, style La Closing Academie.
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

interface TestimonialInfo {
  name: string;
  role: string;
  quote: string;
  result: string;
  videoUrl: string;
  thumbnailId: string;
}

const TESTIMONIAL_PHILIPPE: TestimonialInfo = {
  name: "Philippe Fayette",
  role: "Fondateur et dirigeant ABC Formation",
  quote: "Si j'arr\u00eatais avec La Closing Acad\u00e9mie, je serais un mauvais chef d'entreprise",
  result: "De 1,5 M\u20ac \u00e0 2,7 M\u20ac de chiffre d'affaires en 12 mois",
  videoUrl: "https://www.youtube.com/watch?v=qxPHiC96_ss&t=1s",
  thumbnailId: "qxPHiC96_ss",
};

const TESTIMONIAL_MARGUERITE: TestimonialInfo = {
  name: "Marguerite Monnier",
  role: "Dirigeante",
  quote: "Un accompagnement qui a transform\u00e9 notre approche commerciale",
  result: "Des r\u00e9sultats concrets d\u00e8s les premi\u00e8res semaines",
  videoUrl: "https://www.youtube.com/watch?v=k9TUjjsDe6A&t=2s",
  thumbnailId: "k9TUjjsDe6A",
};

function getTestimonial(meetingType: string): TestimonialInfo {
  if (["R0", "R0+R1", "R1"].includes(meetingType)) return TESTIMONIAL_PHILIPPE;
  return TESTIMONIAL_MARGUERITE;
}

function buildTestimonialBlock(t: TestimonialInfo): string {
  return [
    "",
    "En attendant notre \u00e9change...",
    "",
    "Prenez 2 minutes pour d\u00e9couvrir le t\u00e9moignage d'un dirigeant accompagn\u00e9 par la Closing Acad\u00e9mie.",
    "",
    `${t.result} apr\u00e8s avoir structur\u00e9 son approche commerciale.`,
    "",
    "Cette vid\u00e9o vous permettra d'aborder notre session avec une vision plus concr\u00e8te des r\u00e9sultats possibles.",
    "",
    `\ud83c\udfac T\u00e9moignage de ${t.name} : ${t.videoUrl}`,
  ].join("\n");
}

const introByType: Record<string, (name: string) => string> = {
  R0: (name) => [
    `Bonjour ${name},`,
    "",
    "Je vous confirme notre premier \u00e9change ensemble. L'objectif est simple : comprendre pr\u00e9cis\u00e9ment votre situation et d\u00e9terminer les leviers prioritaires d'am\u00e9lioration.",
    "",
    "Voici les d\u00e9tails :",
  ].join("\n"),

  "R0+R1": (name) => [
    `Bonjour ${name},`,
    "",
    "Je vous confirme notre premier \u00e9change ensemble. L'objectif est simple : comprendre pr\u00e9cis\u00e9ment votre situation et d\u00e9terminer les leviers prioritaires d'am\u00e9lioration.",
    "",
    "Voici les d\u00e9tails :",
  ].join("\n"),

  R1: (name) => [
    `Bonjour ${name},`,
    "",
    "Nous avons h\u00e2te de vous retrouver pour notre rendez-vous d\u00e9couverte ! Ce sera l'occasion d'approfondir vos enjeux, et de conna\u00eetre pr\u00e9cis\u00e9ment comment nous allons pouvoir vous accompagner \u00e0 atteindre vos objectifs.",
    "",
    "Voici les d\u00e9tails :",
  ].join("\n"),

  R2: (name) => [
    `Bonjour ${name},`,
    "",
    "Votre rendez-vous est confirm\u00e9. Nous vous pr\u00e9senterons une solution adapt\u00e9e \u00e0 vos besoins, bas\u00e9e sur nos \u00e9changes pr\u00e9c\u00e9dents.",
    "",
    "Voici les d\u00e9tails :",
  ].join("\n"),

  R3: (name) => [
    `Bonjour ${name},`,
    "",
    "Votre rendez-vous de finalisation est confirm\u00e9. Nous aborderons ensemble les derniers d\u00e9tails pour concr\u00e9tiser notre collaboration.",
    "",
    "Voici les d\u00e9tails :",
  ].join("\n"),
};

export function getProspectEmailBody(p: ProspectEmailParams): string {
  const introFn = introByType[p.meetingType] ?? introByType["R1"];
  const intro = introFn(p.contactFirstName);
  const info = buildInfoBlock(p);
  const testimonial = getTestimonial(p.meetingType);
  const testimonialBlock = buildTestimonialBlock(testimonial);

  return [
    intro,
    "",
    info,
    "",
    "Vous trouverez en pi\u00e8ce jointe une invitation calendrier (.ics) \u00e0 ajouter \u00e0 votre agenda.",
    testimonialBlock,
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
