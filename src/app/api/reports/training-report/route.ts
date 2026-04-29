import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, Header, Footer, PageBreak,
  ShadingType,
} from "docx";

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

function fmtPeriodFr(d: Date) {
  return `${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: BORDER_GRAY };
const cellBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

function headerCell(text: string, widthDxa: number): TableCell {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    shading: { type: ShadingType.SOLID, color: BLUE_DARK, fill: BLUE_DARK },
    borders: cellBorders,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, color: WHITE, font: "Arial", size: 21 })],
    })],
  });
}

function bodyCell(text: string, widthDxa: number, rowIdx: number): TableCell {
  const bg = rowIdx % 2 === 1 ? GRAY_LIGHT : WHITE;
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    shading: { type: ShadingType.SOLID, color: bg, fill: bg },
    borders: cellBorders,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      children: [new TextRun({ text, font: "Arial", size: 21, color: GRAY_DARK })],
    })],
  });
}

function labelValueRow(label: string, value: string, idx: number, colWidths: [number, number]): TableRow {
  const bg = idx % 2 === 1 ? GRAY_LIGHT : WHITE;
  return new TableRow({
    children: [
      new TableCell({
        width: { size: colWidths[0], type: WidthType.DXA },
        shading: { type: ShadingType.SOLID, color: bg, fill: bg },
        borders: cellBorders,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({
          children: [new TextRun({ text: label, bold: true, font: "Arial", size: 21, color: GRAY_DARK })],
        })],
      }),
      new TableCell({
        width: { size: colWidths[1], type: WidthType.DXA },
        shading: { type: ShadingType.SOLID, color: bg, fill: bg },
        borders: cellBorders,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({
          children: [new TextRun({ text: value, font: "Arial", size: 21, color: GRAY_DARK })],
        })],
      }),
    ],
  });
}

function buildLearnerSections(
  learner: { first_name: string; last_name: string; position: string | null },
  companyName: string,
  sessions: { session_date: string; session_type: string; duration_hours: number; trainers: string[]; notes: string | null; status: string }[],
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
  const todayStr = `${String(today.getDate()).padStart(2,"0")} ${MONTHS_FR[today.getMonth()]} ${today.getFullYear()}`;

  const elements: Paragraph[] = [];

  // Page break if not the first learner
  if (!isFirst) {
    elements.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // ===== COVER PAGE =====
  elements.push(new Paragraph({ spacing: { before: 2400 }, children: [] }));
  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: "REPORTING DE FORMATION", bold: true, font: "Arial", size: 48, color: BLUE_DARK })],
  }));
  // Gold line
  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD, space: 1 } },
    children: [new TextRun({ text: " ", font: "Arial", size: 8 })],
  }));
  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [new TextRun({ text: "Accompagnement individuel", font: "Arial", size: 28, color: BLUE_MED, italics: true })],
  }));
  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 600 },
    children: [new TextRun({ text: periodStr, font: "Arial", size: 24, color: GRAY_DARK })],
  }));
  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [new TextRun({ text: fullName, bold: true, font: "Arial", size: 36, color: BLUE_DARK })],
  }));
  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [new TextRun({ text: `${position} – ${companyName}`, font: "Arial", size: 24, color: GRAY_DARK })],
  }));
  elements.push(new Paragraph({ spacing: { after: 800 }, children: [] }));
  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: "Formateur : Loïc Martel", bold: true, font: "Arial", size: 22, color: BLUE_DARK })],
  }));
  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: "Consultant Expert – La Closing Académie", font: "Arial", size: 22, color: GRAY_DARK })],
  }));
  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: `Document établi le ${todayStr}`, font: "Arial", size: 20, color: "666666" })],
  }));

  // Page break after cover
  elements.push(new Paragraph({ children: [new PageBreak()] }));

  // ===== SECTION 1 — Contexte =====
  elements.push(new Paragraph({
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text: "1. Contexte de l'accompagnement", bold: true, font: "Arial", size: 28, color: BLUE_DARK })],
  }));
  elements.push(new Paragraph({
    spacing: { after: 200 },
    children: [new TextRun({
      text: `Ce document constitue le reporting des sessions de formation réalisées avec ${fullName}, ${position} chez ${companyName}. L'accompagnement s'est déroulé de ${MONTHS_FR[firstDate.getMonth()]} ${firstDate.getFullYear()} à ${MONTHS_FR[lastDate.getMonth()]} ${lastDate.getFullYear()}, à raison de ${doneSessions.length} session${doneSessions.length > 1 ? "s" : ""}.`,
      font: "Arial", size: 21, color: GRAY_DARK,
    })],
  }));

  // ===== SECTION 2 — Informations générales =====
  elements.push(new Paragraph({
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text: "2. Informations générales", bold: true, font: "Arial", size: 28, color: BLUE_DARK })],
  }));

  const infoColWidths: [number, number] = [3200, 5800];
  const infoRows = [
    ["Collaborateur", fullName],
    ["Poste", position],
    ["Établissement", companyName],
    ["Formateur", "Loïc Martel – Consultant Expert, La Closing Académie"],
    ["Période", periodStr],
    ["Nombre de sessions", `${doneSessions.length} session${doneSessions.length > 1 ? "s" : ""}`],
    ["Format", formatLabel],
  ];
  elements.push(new Paragraph({ children: [] })); // spacer
  const infoTable = new Table({
    columnWidths: infoColWidths,
    rows: infoRows.map(([label, value], i) => labelValueRow(label, value, i, infoColWidths)),
  });
  elements.push(infoTable as unknown as Paragraph);

  // ===== SECTION 3 — Détail des sessions =====
  elements.push(new Paragraph({
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text: "3. Détail des sessions de formation", bold: true, font: "Arial", size: 28, color: BLUE_DARK })],
  }));

  if (doneSessions.length === 0) {
    elements.push(new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: "Aucune session réalisée pour cet apprenant.", font: "Arial", size: 21, color: "666666", italics: true })],
    }));
  } else {
    elements.push(new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({
        text: "Le tableau ci-dessous présente le détail chronologique de chaque session de formation.",
        font: "Arial", size: 21, color: GRAY_DARK,
      })],
    }));

    const sessionColWidths = [1500, 2000, 5500];
    const sessionHeaderRow = new TableRow({
      children: [
        headerCell("Date", sessionColWidths[0]),
        headerCell("Type / Durée", sessionColWidths[1]),
        headerCell("Notes et observations", sessionColWidths[2]),
      ],
    });

    const sessionDataRows = doneSessions.map((s, i) => {
      const typeLabel = s.session_type === "journee" ? "Journée" : "VT";
      const duration = `${Number(s.duration_hours) || 1}h`;
      return new TableRow({
        children: [
          bodyCell(fmtDateFr(s.session_date), sessionColWidths[0], i),
          bodyCell(`${typeLabel} – ${duration}`, sessionColWidths[1], i),
          bodyCell(s.notes || "Aucune note", sessionColWidths[2], i),
        ],
      });
    });

    const sessionsTable = new Table({
      columnWidths: sessionColWidths,
      rows: [sessionHeaderRow, ...sessionDataRows],
    });
    elements.push(sessionsTable as unknown as Paragraph);
  }

  // ===== Signature =====
  elements.push(new Paragraph({ spacing: { before: 800 }, children: [] }));
  elements.push(new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text: "Loïc Martel – Consultant Expert – La Closing Académie", bold: true, font: "Arial", size: 21, color: BLUE_DARK })],
  }));
  elements.push(new Paragraph({
    children: [new TextRun({ text: "loic@closing-academie.com", font: "Arial", size: 21, color: BLUE_MED })],
  }));

  return elements;
}

export async function POST(req: NextRequest) {
  try {
    const { companyId, companyName, learnerIds } = (await req.json()) as {
      companyId: string;
      companyName: string;
      learnerIds: string[];
    };

    if (!companyId || !learnerIds?.length) {
      return NextResponse.json({ error: "companyId and learnerIds required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch learners
    const { data: learners } = await supabase
      .from("learners")
      .select("id, first_name, last_name, position")
      .in("id", learnerIds);

    if (!learners || learners.length === 0) {
      return NextResponse.json({ error: "No learners found" }, { status: 404 });
    }

    // Fetch all sessions for each learner via junction table
    const { data: sessionLinks } = await supabase
      .from("training_session_learners")
      .select("learner_id, training_sessions(*)")
      .in("learner_id", learnerIds);

    // Group sessions by learner
    const sessionsByLearner = new Map<string, any[]>();
    for (const link of sessionLinks ?? []) {
      const learnerId = link.learner_id;
      const session = link.training_sessions as any;
      if (!session) continue;
      if (!sessionsByLearner.has(learnerId)) sessionsByLearner.set(learnerId, []);
      sessionsByLearner.get(learnerId)!.push(session);
    }

    // Build document sections for each learner
    const allElements: Paragraph[] = [];
    learners.forEach((learner, idx) => {
      const sessions = sessionsByLearner.get(learner.id) ?? [];
      const sections = buildLearnerSections(
        { first_name: learner.first_name, last_name: learner.last_name, position: learner.position },
        companyName,
        sessions,
        idx === 0,
      );
      allElements.push(...sections);
    });

    // Assemble document
    const firstLearner = learners[0];
    const doc = new Document({
      styles: {
        default: {
          document: { run: { font: "Arial", size: 21, color: GRAY_DARK } },
        },
      },
      sections: [{
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
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

    const fileName = learners.length === 1
      ? `Reporting_Formation_${firstLearner.first_name}_${companyName.replace(/[^a-zA-Z0-9àâéèêëïîôùûüÿçÀÂÉÈÊËÏÎÔÙÛÜŸÇ ]/g, "").replace(/ /g, "_")}.docx`
      : `Reporting_Formation_${companyName.replace(/[^a-zA-Z0-9àâéèêëïîôùûüÿçÀÂÉÈÊËÏÎÔÙÛÜŸÇ ]/g, "").replace(/ /g, "_")}.docx`;

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
