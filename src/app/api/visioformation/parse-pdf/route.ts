import { NextResponse } from "next/server";

function detectType(titre: string): { type: "journee" | "vt"; jourLabel: string } {
  const vtMatch = titre.match(/\bVT\s*(\d*)\b/i);
  if (vtMatch) return { type: "vt", jourLabel: `VT${vtMatch[1] || ""}` };
  const jMatch = titre.match(/[_\s]?J(\d+)\b/i) || titre.match(/^J(\d+)\b/i);
  if (jMatch) return { type: "journee", jourLabel: `J${jMatch[1]}` };
  return { type: "journee", jourLabel: "" };
}

function parseBilanText(text: string) {
  const result: {
    apprenants: string[];
    formateurs: string[];
    creneaux: {
      numero: number; date: string; heureDebut: string; heureFin: string;
      dureeHeures: number; titre: string; type: "journee" | "vt"; jourLabel: string;
    }[];
  } = { apprenants: [], formateurs: [], creneaux: [] };

  const appMatch = text.match(/Apprenant\(s\):\s*([\s\S]*?)(?=Formateur\(s\):)/);
  if (appMatch) {
    result.apprenants = appMatch[1].replace(/\n/g, " ").trim().split(",").map((s) => s.trim()).filter(Boolean);
  }

  const formMatch = text.match(/Formateur\(s\):\s*(.*?)(?=\n)/);
  if (formMatch) {
    result.formateurs = formMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
  }

  const creneauRegex = /Créneau\s+(\d+)\s*\n\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):\d{2}\s*-\s*\d{2}\/\d{2}\/\d{4}\s+(\d{2}):(\d{2}):\d{2}\s*\((\d+)h(\d{2})\)\s*-\s*(.+?)(?=\n)/g;
  let match;
  while ((match = creneauRegex.exec(text)) !== null) {
    const [, numero, jour, mois, annee, hDebut, mDebut, hFin, mFin, dureeH, dureeM, titre] = match;
    const { type, jourLabel } = detectType(titre.trim());
    result.creneaux.push({
      numero: parseInt(numero),
      date: `${annee}-${mois}-${jour}`,
      heureDebut: `${hDebut}:${mDebut}`,
      heureFin: `${hFin}:${mFin}`,
      dureeHeures: parseInt(dureeH) + parseInt(dureeM) / 60,
      titre: titre.trim(),
      type,
      jourLabel,
    });
  }

  return result;
}

export async function POST(request: Request) {
  try {
    const buffer = await request.arrayBuffer();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(Buffer.from(buffer));

    const parsed = parseBilanText(data.text);

    if (parsed.creneaux.length === 0) {
      return NextResponse.json({
        error: "Aucun créneau détecté dans le PDF. Vérifiez que c'est bien un bilan quotidien Visioformation.",
      });
    }

    return NextResponse.json(parsed);
  } catch (e: any) {
    return NextResponse.json({ error: `Erreur de parsing: ${e.message}` }, { status: 500 });
  }
}
