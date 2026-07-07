import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/api-auth";
import Anthropic from "@anthropic-ai/sdk";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, Header, Footer, PageBreak,
  ShadingType,
} from "docx";

import { fmtDuration } from "@/lib/utils";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/* ---- Design tokens ---- */
const BLUE_DARK = "1B3A5C";
const BLUE_MED = "2E75B6";
const GOLD = "C49A3C";
const GRAY_DARK = "333333";
const GRAY_LIGHT = "F2F2F2";
const BORDER_GRAY = "CCCCCC";
const WHITE = "FFFFFF";

const MONTHS_FR = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

function fmtDateFr(d: string) {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}`;
}
function fmtPeriodFr(d: Date) { return `${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`; }
function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ---- docx helpers ---- */
const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: BORDER_GRAY };
const cellBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

function headerCell(text: string, w: number): TableCell {
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    shading: { type: ShadingType.SOLID, color: BLUE_DARK, fill: BLUE_DARK },
    borders: cellBorders,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: WHITE, font: "Arial", size: 21 })] })],
  });
}

function bodyCell(text: string, w: number, row: number): TableCell {
  const bg = row % 2 === 1 ? GRAY_LIGHT : WHITE;
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    shading: { type: ShadingType.SOLID, color: bg, fill: bg },
    borders: cellBorders,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text, font: "Arial", size: 21, color: GRAY_DARK })] })],
  });
}

function lvRow(label: string, value: string, i: number, cw: [number, number]): TableRow {
  const bg = i % 2 === 1 ? GRAY_LIGHT : WHITE;
  const mkCell = (t: string, w: number, bold: boolean) => new TableCell({
    width: { size: w, type: WidthType.DXA },
    shading: { type: ShadingType.SOLID, color: bg, fill: bg },
    borders: cellBorders,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text: t, bold, font: "Arial", size: 21, color: GRAY_DARK })] })],
  });
  return new TableRow({ children: [mkCell(label, cw[0], true), mkCell(value, cw[1], false)] });
}

function heading(text: string, level: 1 | 2 = 1): Paragraph {
  const size = level === 1 ? 28 : 24;
  return new Paragraph({
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text, bold: true, font: "Arial", size, color: level === 1 ? BLUE_DARK : BLUE_MED })],
  });
}

function bodyParagraph(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 160 },
    children: [new TextRun({ text, font: "Arial", size: 21, color: GRAY_DARK })],
  });
}

/* ---- AI enrichment types ---- */
interface EnrichedReport {
  contexte: string[];
  sessions: { date: string; theme: string; contenu: string }[];
  synthese: { domaine: string; acquis: string; sessions_liees: string }[];
  methodes: { titre: string; description: string }[];
  progression: { evolution: string; marqueurs: string };
  preconisations: { points_forts: string[]; axes_developpement: string[]; perspectives: string };
}

async function enrichWithClaude(
  learnerName: string, position: string, companyName: string,
  rawSessions: { date: string; type: string; duration: string; notes: string }[],
): Promise<EnrichedReport> {
  const notesBlock = rawSessions.map(s => `${s.date} (${s.type}, ${s.duration}) : ${s.notes}`).join("\n");

  const prompt = `Tu es un expert en rédaction de reporting de formation professionnelle pour La Closing Académie.

Voici les notes brutes des sessions de formation de ${learnerName}, ${position} chez ${companyName} :

${notesBlock}

À partir de ces notes, génère un JSON structuré avec le contenu enrichi du reporting. Transforme les notes télégraphiques en prose professionnelle, développée et contextualisée. Le ton est professionnel, valorisant sans être complaisant, factuel et tourné vers l'action. Vouvoiement ou style impersonnel.

IMPORTANT :
- Ne pas inventer de contenu qui n'est pas dans les notes
- Développer chaque note en paragraphes complets
- Relier les sessions entre elles pour montrer une progression
- Rechercher et expliquer les méthodes mentionnées (DISC, MIDORI, CNV, etc.)

Réponds UNIQUEMENT avec un JSON valide (pas de markdown, pas de commentaires) avec cette structure :
{
  "contexte": ["paragraphe 1 du contexte", "paragraphe 2", "paragraphe 3 éventuel"],
  "sessions": [
    {"date": "dd/MM/yyyy", "theme": "Titre court du thème", "contenu": "Paragraphes développés du contenu et observations de la session. Peut être long."}
  ],
  "synthese": [
    {"domaine": "Nom du domaine de compétence", "acquis": "Synthèse des acquis dans ce domaine", "sessions_liees": "dates des sessions liées"}
  ],
  "methodes": [
    {"titre": "Nom de la méthode", "description": "Description détaillée de la méthode et comment elle a été appliquée"}
  ],
  "progression": {
    "evolution": "Paragraphe sur l'évolution professionnelle observée",
    "marqueurs": "Paragraphe sur les marqueurs qualitatifs de progression"
  },
  "preconisations": {
    "points_forts": ["Point fort 1 avec exemple", "Point fort 2", "Point fort 3"],
    "axes_developpement": ["Axe 1 formulé positivement", "Axe 2", "Axe 3"],
    "perspectives": "Paragraphe sur les perspectives d'évolution"
  }
}`;

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = (msg.content[0] as { type: string; text: string }).text;
  // Extract JSON from response (handle potential markdown wrapping)
  const jsonStr = text.replace(/^```json\s*/, "").replace(/```\s*$/, "").trim();
  return JSON.parse(jsonStr) as EnrichedReport;
}

/* ---- Build docx sections for one learner ---- */
function buildLearnerSections(
  learner: { first_name: string; last_name: string; position: string | null },
  companyName: string,
  sessions: { session_date: string; session_type: string; duration_hours: number; trainers: string[]; notes: string | null; status: string }[],
  enriched: EnrichedReport,
  isFirst: boolean,
): Paragraph[] {
  const fullName = `${learner.first_name} ${learner.last_name}`;
  const position = learner.position || "Collaborateur";
  const doneSessions = sessions
    .filter(s => s.status === "done" || s.status === "no_show")
    .sort((a, b) => a.session_date.localeCompare(b.session_date));

  const firstDate = doneSessions.length > 0 ? new Date(doneSessions[0].session_date) : new Date();
  const lastDate = doneSessions.length > 0 ? new Date(doneSessions[doneSessions.length - 1].session_date) : new Date();
  const periodStr = `${capitalize(fmtPeriodFr(firstDate))} – ${capitalize(fmtPeriodFr(lastDate))}`;
  const hasJournee = doneSessions.some(s => s.session_type === "journee");
  const hasVt = doneSessions.some(s => s.session_type === "vt");
  const formatLabel = hasJournee && hasVt ? "Présentiel et visioconférence" : hasJournee ? "Présentiel" : "Visioconférence";

  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, "0")} ${MONTHS_FR[today.getMonth()]} ${today.getFullYear()}`;
  const el: Paragraph[] = [];

  if (!isFirst) el.push(new Paragraph({ children: [new PageBreak()] }));

  // ===== COVER =====
  el.push(new Paragraph({ spacing: { before: 2400 }, children: [] }));
  el.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "REPORTING DE FORMATION", bold: true, font: "Arial", size: 48, color: BLUE_DARK })] }));
  el.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD, space: 1 } }, children: [new TextRun({ text: " ", font: "Arial", size: 8 })] }));
  el.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "Accompagnement individuel", font: "Arial", size: 28, color: BLUE_MED, italics: true })] }));
  el.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: periodStr, font: "Arial", size: 24, color: GRAY_DARK })] }));
  el.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: fullName, bold: true, font: "Arial", size: 36, color: BLUE_DARK })] }));
  el.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: `${position} – ${companyName}`, font: "Arial", size: 24, color: GRAY_DARK })] }));
  el.push(new Paragraph({ spacing: { after: 800 }, children: [] }));
  el.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: "Formateur : Loïc Martel", bold: true, font: "Arial", size: 22, color: BLUE_DARK })] }));
  el.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "Consultant Expert – La Closing Académie", font: "Arial", size: 22, color: GRAY_DARK })] }));
  el.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: `Document établi le ${todayStr}`, font: "Arial", size: 20, color: "666666" })] }));
  el.push(new Paragraph({ children: [new PageBreak()] }));

  // ===== 1. Contexte =====
  el.push(heading("1. Contexte de l'accompagnement"));
  for (const p of enriched.contexte) el.push(bodyParagraph(p));

  // ===== 2. Infos générales =====
  el.push(heading("2. Informations générales"));
  const icw: [number, number] = [3200, 5800];
  el.push(new Table({
    columnWidths: icw,
    rows: [
      ["Collaborateur", fullName], ["Poste", position], ["Établissement", companyName],
      ["Formateur", "Loïc Martel – Consultant Expert, La Closing Académie"],
      ["Période", periodStr], ["Nombre de sessions", `${doneSessions.length} sessions`], ["Format", formatLabel],
    ].map(([l, v], i) => lvRow(l, v, i, icw)),
  }) as unknown as Paragraph);

  // ===== 3. Détail des sessions =====
  el.push(heading("3. Détail des sessions de formation"));
  el.push(bodyParagraph("Le tableau ci-dessous présente le détail chronologique de chaque session de formation, incluant les thématiques abordées et les observations du formateur."));

  const scw = [1500, 2000, 5500];
  const sRows = enriched.sessions.map((s, i) => new TableRow({
    children: [bodyCell(s.date, scw[0], i), bodyCell(s.theme, scw[1], i), bodyCell(s.contenu, scw[2], i)],
  }));
  el.push(new Table({
    columnWidths: scw,
    rows: [new TableRow({ children: [headerCell("Date", scw[0]), headerCell("Thème", scw[1]), headerCell("Contenu et observations", scw[2])] }), ...sRows],
  }) as unknown as Paragraph);

  // ===== 4. Synthèse par domaine =====
  if (enriched.synthese.length > 0) {
    el.push(heading("4. Synthèse par domaine de compétence"));
    el.push(bodyParagraph("Cette section propose une lecture transversale des acquis, organisée par domaine de compétence."));
    const dcw = [2200, 5000, 1800];
    const dRows = enriched.synthese.map((s, i) => new TableRow({
      children: [bodyCell(s.domaine, dcw[0], i), bodyCell(s.acquis, dcw[1], i), bodyCell(s.sessions_liees, dcw[2], i)],
    }));
    el.push(new Table({
      columnWidths: dcw,
      rows: [new TableRow({ children: [headerCell("Domaine", dcw[0]), headerCell("Synthèse des acquis", dcw[1]), headerCell("Sessions liées", dcw[2])] }), ...dRows],
    }) as unknown as Paragraph);
  }

  // ===== 5. Focus méthodes =====
  if (enriched.methodes.length > 0) {
    el.push(heading("5. Focus sur les méthodes et outils utilisés"));
    enriched.methodes.forEach((m, i) => {
      el.push(heading(`5.${i + 1} ${m.titre}`, 2));
      el.push(bodyParagraph(m.description));
    });
  }

  // ===== 6. Progression =====
  el.push(heading("6. Progression et résultats observés"));
  el.push(heading("6.1 Évolution professionnelle", 2));
  el.push(bodyParagraph(enriched.progression.evolution));
  el.push(heading("6.2 Marqueurs qualitatifs", 2));
  el.push(bodyParagraph(enriched.progression.marqueurs));

  // ===== 7. Préconisations =====
  el.push(heading("7. Préconisations pour l'entretien professionnel"));
  el.push(bodyParagraph("Ce reporting peut servir de base factuelle pour l'entretien professionnel. Voici les axes suggérés :"));

  el.push(heading("7.1 Points forts à valoriser", 2));
  for (const p of enriched.preconisations.points_forts) el.push(bodyParagraph(`• ${p}`));

  el.push(heading("7.2 Axes de développement à poursuivre", 2));
  for (const a of enriched.preconisations.axes_developpement) el.push(bodyParagraph(`• ${a}`));

  el.push(heading("7.3 Perspectives d'évolution", 2));
  el.push(bodyParagraph(enriched.preconisations.perspectives));

  // ===== Signature =====
  el.push(new Paragraph({ spacing: { before: 800 }, children: [] }));
  el.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Loïc Martel – Consultant Expert – La Closing Académie", bold: true, font: "Arial", size: 21, color: BLUE_DARK })] }));
  el.push(new Paragraph({ children: [new TextRun({ text: "loic@closing-academie.com", font: "Arial", size: 21, color: BLUE_MED })] }));

  return el;
}

/* ---- Route handler ---- */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireMember();
    if (auth instanceof NextResponse) return auth;

    const { companyId, companyName, learnerIds, dateFrom, dateTo } = (await req.json()) as {
      companyId: string; companyName: string; learnerIds: string[];
      dateFrom?: string; dateTo?: string;
    };

    if (!companyId || !learnerIds?.length) {
      return NextResponse.json({ error: "companyId and learnerIds required" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: learners } = await supabase
      .from("learners")
      .select("id, first_name, last_name, position")
      .in("id", learnerIds);

    if (!learners || learners.length === 0) {
      return NextResponse.json({ error: "No learners found" }, { status: 404 });
    }

    const { data: sessionLinks } = await supabase
      .from("training_session_learners")
      .select("learner_id, training_sessions(*)")
      .in("learner_id", learnerIds);

    const sessionsByLearner = new Map<string, any[]>();
    for (const link of sessionLinks ?? []) {
      const session = link.training_sessions as any;
      if (!session) continue;
      const arr = sessionsByLearner.get(link.learner_id) ?? [];
      arr.push(session);
      sessionsByLearner.set(link.learner_id, arr);
    }

    // Process each learner: enrich with Claude then build docx sections
    const allElements: Paragraph[] = [];
    for (let idx = 0; idx < learners.length; idx++) {
      const learner = learners[idx];
      const sessions = (sessionsByLearner.get(learner.id) ?? [])
        .filter((s: any) => {
          if (s.status !== "done" && s.status !== "no_show") return false;
          if (dateFrom && s.session_date < dateFrom) return false;
          if (dateTo && s.session_date > dateTo) return false;
          return true;
        })
        .sort((a: any, b: any) => a.session_date.localeCompare(b.session_date));

      // Prepare raw notes for Claude
      const rawSessions = sessions.map((s: any) => ({
        date: fmtDateFr(s.session_date),
        type: s.session_type === "journee" ? "Journée" : "VT",
        duration: fmtDuration(Number(s.duration_hours) || 1),
        notes: s.notes || "Pas de notes",
      }));

      let enriched: EnrichedReport;
      if (rawSessions.length > 0 && rawSessions.some(s => s.notes !== "Pas de notes")) {
        enriched = await enrichWithClaude(
          `${learner.first_name} ${learner.last_name}`,
          learner.position || "Collaborateur",
          companyName,
          rawSessions,
        );
      } else {
        // Fallback: no AI enrichment if no notes
        enriched = {
          contexte: [`Ce document constitue le reporting des sessions de formation réalisées avec ${learner.first_name} ${learner.last_name}, ${learner.position || "Collaborateur"} chez ${companyName}.`],
          sessions: rawSessions.map(s => ({ date: s.date, theme: `${s.type} – ${s.duration}`, contenu: s.notes })),
          synthese: [],
          methodes: [],
          progression: { evolution: "Données insuffisantes pour évaluer la progression.", marqueurs: "Données insuffisantes." },
          preconisations: { points_forts: [], axes_developpement: [], perspectives: "Données insuffisantes pour formuler des perspectives." },
        };
      }

      const sections = buildLearnerSections(
        { first_name: learner.first_name, last_name: learner.last_name, position: learner.position },
        companyName, sessions, enriched, idx === 0,
      );
      allElements.push(...sections);
    }

    const firstLearner = learners[0];
    const doc = new Document({
      styles: { default: { document: { run: { font: "Arial", size: 21, color: GRAY_DARK } } } },
      sections: [{
        properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
        headers: {
          default: new Header({
            children: [new Paragraph({
              border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: BLUE_MED, space: 4 } },
              children: [
                new TextRun({ text: `Reporting de formation – ${firstLearner.first_name}`, font: "Arial", size: 18, color: BLUE_MED }),
                new TextRun({ text: `\t\t${companyName}`, font: "Arial", size: 18, color: "666666" }),
              ],
            })],
          }),
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              border: { top: { style: BorderStyle.SINGLE, size: 1, color: "D5E8F0", space: 4 } },
              children: [new TextRun({ text: "Loïc Martel – La Closing Académie", font: "Arial", size: 16, color: "666666" })],
            })],
          }),
        },
        children: allElements,
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    const safeName = companyName.replace(/[^a-zA-Z0-9àâéèêëïîôùûüÿçÀÂÉÈÊËÏÎÔÙÛÜŸÇ ]/g, "").replace(/ /g, "_");
    const fileName = learners.length === 1
      ? `Reporting_Formation_${firstLearner.first_name}_${safeName}.docx`
      : `Reporting_Formation_${safeName}.docx`;

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err: any) {
    console.error("[training-report] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
