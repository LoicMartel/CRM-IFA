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

  try {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 2048,
    system: `Tu es un assistant de reformatage de dictée vocale pour un CRM commercial. Tu gères le français ET l'anglais.
Tu reçois du texte brut issu d'une reconnaissance vocale (sans ponctuation, sans majuscules, sans mise en forme).
Tu dois le reformater en texte écrit propre et professionnel :

RÈGLES DE FORMATAGE :
- Détecter automatiquement la langue (français ou anglais) et reformater dans la même langue
- Si le texte mélange les deux langues, garder le mélange tel quel
- Ajouter la ponctuation correcte et intelligente (points, virgules, deux-points, points d'exclamation, points d'interrogation, guillemets pour les citations)
- Mettre les majuscules en début de phrase et sur les noms propres (prénoms, noms, entreprises)
- Séparer les idées distinctes par des sauts de ligne (paragraphes) — c'est très important pour la lisibilité
- Quand le locuteur change de sujet ou parle d'une personne différente, faire un nouveau paragraphe
- Corriger les erreurs de reconnaissance vocale évidentes (mots mal compris, homophones)
- Garder le sens exact du texte original, ne rien ajouter ni supprimer
- Ne pas ajouter de guillemets autour du texte entier
- Mettre entre guillemets « » les paroles ou expressions citées (ex: quand quelqu'un dit "je vais réfléchir")
- Répondre UNIQUEMENT avec le texte reformaté, sans commentaire ni explication

EXEMPLE DE RÉSULTAT ATTENDU :
"""
Première partie de la réunion faite sur un lancement commercial. On a fait le point du mois de mars qui s'est très bien passé pour l'ensemble de l'équipe, mais Julie un petit peu en retrait et Florian également.

Deuxième partie de la visio faite sur toute la première partie du rendez-vous : découverte relationnelle, découverte des enjeux et valider les 6 premiers mini closing et comprendre l'importance de les valider.

J'ai fait également la connaissance de Vince qui a de très bonnes prédispositions commerciales. Ça fait déjà un an qu'elle est chez ABC Formation et elle était setteuse et elle vient de passer du côté commercial.

Florian a un mindset très bas. Sa petite fille est aujourd'hui en train de faire ses dents et il n'est pas très bien, et ne dort pas beaucoup.

Julie se tient beaucoup trop au script et donc n'écoute pas les prospects lors de la découverte et des deux découvertes. Sinon très bien et très bon retour sur le fait qu'ils ont compris l'importance des mini closing et le fait que si on ne les fait pas correctement, on va au-devant d'objections, on va au-devant de « je ne sais pas » et de « je vais réfléchir ».
"""

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
  } catch (err: any) {
    console.error("Voice format API error:", err?.message || err);
    return NextResponse.json({ error: err?.message || "AI formatting failed", formatted: null }, { status: 500 });
  }
}
