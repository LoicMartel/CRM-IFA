import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TONE_INSTRUCTIONS: Record<string, string> = {
  neutral: "Reformate le texte de manière neutre et naturelle, comme un texte écrit standard.",
  professional: "Reformate le texte dans un ton professionnel et formel. Utilise un vocabulaire soutenu, des formulations business. Vouvoiement si pertinent.",
  friendly: "Reformate le texte dans un ton amical et chaleureux. Garde un style décontracté mais correct. Tutoiement si pertinent.",
  concise: "Reformate le texte de manière très concise. Va droit à l'essentiel, supprime les répétitions et les mots superflus. Phrases courtes.",
  detailed: "Reformate le texte de manière détaillée et structurée. Développe les idées, ajoute des connecteurs logiques, organise en paragraphes clairs.",
};

export async function POST(request: Request) {
  const { rawText, existingText, tone, names } = await request.json();

  if (!rawText?.trim()) {
    return NextResponse.json({ error: "Missing rawText" }, { status: 400 });
  }

  const toneInstruction = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.neutral;
  const namesContext = names && names.length > 0
    ? `\n\nNOMS PROPRES CONNUS (stagiaires, contacts, entreprises) — corrige la reconnaissance vocale pour correspondre à ces noms si un mot prononcé y ressemble :\n${names.join(", ")}`
    : "";

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: `Tu es un assistant de reformatage de dictée vocale. Tu gères le français ET l'anglais.
Tu reçois du texte brut issu d'une reconnaissance vocale (sans ponctuation, sans majuscules, sans mise en forme).
Tu dois le reformater en texte écrit propre :
- Détecter automatiquement la langue (français ou anglais) et reformater dans la même langue
- Si le texte mélange les deux langues, garder le mélange tel quel
- Ajouter la ponctuation correcte (points, virgules, points d'exclamation, points d'interrogation)
- Mettre les majuscules en début de phrase et sur les noms propres
- Ajouter des retours à la ligne pour séparer les paragraphes ou idées distinctes
- Corriger les petites erreurs de reconnaissance vocale évidentes
- Garder le sens exact du texte original, ne rien ajouter ni supprimer
- Ne pas ajouter de guillemets autour du texte
- Répondre UNIQUEMENT avec le texte reformaté, sans commentaire ni explication

STYLE ET TON : ${toneInstruction}${namesContext}`,
    messages: [
      {
        role: "user",
        content: existingText
          ? `Texte déjà écrit dans le champ :\n"""${existingText}"""\n\nNouveau texte dicté à reformater et ajouter à la suite :\n"""${rawText}"""`
          : `Texte dicté à reformater :\n"""${rawText}"""`,
      },
    ],
  });

  const formatted = response.content[0].type === "text" ? response.content[0].text : rawText;

  return NextResponse.json({ formatted });
}
