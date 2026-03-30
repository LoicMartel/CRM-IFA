import { splitName } from "@/lib/visioformation";

export interface ParsedCreneau {
  numero: number;
  date: string;        // YYYY-MM-DD
  heureDebut: string;  // HH:MM
  heureFin: string;    // HH:MM
  dureeHeures: number;
  titre: string;       // e.g. "J1 3R Consultants" or "BUSINESS FRANCE_J1"
  type: "journee" | "vt"; // J → journee, VT → vt
  jourLabel: string;   // "J1", "J2", "VT1", etc.
}

export interface ParsedBilanPDF {
  apprenants: string[];     // raw names
  formateurs: string[];     // raw names
  creneaux: ParsedCreneau[];
}

function detectType(titre: string): { type: "journee" | "vt"; jourLabel: string } {
  // Look for VT or VTx pattern
  const vtMatch = titre.match(/\bVT\s*(\d*)\b/i);
  if (vtMatch) {
    return { type: "vt", jourLabel: `VT${vtMatch[1] || ""}` };
  }
  // Look for Jx pattern (J1, J2, etc.) — can be preceded by underscore or space
  const jMatch = titre.match(/[_\s]?J(\d+)\b/i) || titre.match(/^J(\d+)\b/i);
  if (jMatch) {
    return { type: "journee", jourLabel: `J${jMatch[1]}` };
  }
  // Default: if duration >= 7h it's journee, otherwise vt (handled in caller)
  return { type: "journee", jourLabel: "" };
}

export function parseBilanPDF(text: string): ParsedBilanPDF {
  const result: ParsedBilanPDF = {
    apprenants: [],
    formateurs: [],
    creneaux: [],
  };

  // Extract apprenants
  const appMatch = text.match(/Apprenant\(s\):\s*([\s\S]*?)(?=Formateur\(s\):)/);
  if (appMatch) {
    const raw = appMatch[1].replace(/\n/g, " ").trim();
    result.apprenants = raw.split(",").map((s) => s.trim()).filter(Boolean);
  }

  // Extract formateurs
  const formMatch = text.match(/Formateur\(s\):\s*(.*?)(?=\n)/);
  if (formMatch) {
    result.formateurs = formMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
  }

  // Extract créneaux
  // Pattern: DD/MM/YYYY HH:MM:SS - DD/MM/YYYY HH:MM:SS (XhMM) - TITRE
  const creneauRegex = /Créneau\s+(\d+)\s*\n\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):\d{2}\s*-\s*\d{2}\/\d{2}\/\d{4}\s+(\d{2}):(\d{2}):\d{2}\s*\((\d+)h(\d{2})\)\s*-\s*(.+?)(?=\n)/g;

  let match;
  while ((match = creneauRegex.exec(text)) !== null) {
    const [, numero, jour, mois, annee, hDebut, mDebut, hFin, mFin, dureeH, dureeM, titre] = match;

    const date = `${annee}-${mois}-${jour}`;
    const heureDebut = `${hDebut}:${mDebut}`;
    const heureFin = `${hFin}:${mFin}`;
    const dureeHeures = parseInt(dureeH) + parseInt(dureeM) / 60;
    const titreClean = titre.trim();
    const { type, jourLabel } = detectType(titreClean);

    result.creneaux.push({
      numero: parseInt(numero),
      date,
      heureDebut,
      heureFin,
      dureeHeures,
      titre: titreClean,
      type,
      jourLabel,
    });
  }

  return result;
}

// Group créneaux by day (for merging matin + après-midi option)
export function groupCreneauxByDay(creneaux: ParsedCreneau[]): Map<string, ParsedCreneau[]> {
  const byDay = new Map<string, ParsedCreneau[]>();
  for (const c of creneaux) {
    const key = c.date;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(c);
  }
  return byDay;
}

export function mergeCreneauxForDay(creneaux: ParsedCreneau[]): ParsedCreneau {
  const sorted = [...creneaux].sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
  return {
    numero: sorted[0].numero,
    date: sorted[0].date,
    heureDebut: sorted[0].heureDebut,
    heureFin: sorted[sorted.length - 1].heureFin,
    dureeHeures: sorted.reduce((sum, c) => sum + c.dureeHeures, 0),
    titre: sorted[0].titre,
    type: sorted[0].type,
    jourLabel: sorted[0].jourLabel,
  };
}

export function extractTrainerFirstNames(formateurs: string[]): string[] {
  return formateurs.map((f) => {
    const { firstName } = splitName(f);
    return firstName || f;
  });
}
