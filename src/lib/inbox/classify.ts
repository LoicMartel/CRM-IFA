import Anthropic from "@anthropic-ai/sdk";
import { svc } from "./ingest";
import type { Category, Intent } from "./types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// a/b/c + intent rules are UNCHANGED (the leads agent relies on them). The scoring block (chantier
// F P1, copilote Rafi) is appended so the single classify call also emits an opportunity score —
// no extra LLM call.
const RULES = `Catégories (choisis UNE):
- "a" = inutile / à ignorer : newsletters, promos, no-reply, spam, démarchage automatisé.
- "b" = à répondre : demande légitime non urgente (question, info, prise de contact).
- "c" = prioritaire : prospect chaud, demande de devis, RDV, client mécontent, opportunité commerciale.
Intent (choisis UN): "rdv", "devis", "question", "spam", "autre".

Score d'intérêt commercial (interest_score, entier 0-100) — probabilité que ce message soit une VRAIE opportunité commerciale pour un organisme de formation au closing (B2B) :
- 80-100 : prospect chaud, demande explicite de devis/RDV/formation, dirigeant/décideur.
- 50-79 : intérêt commercial plausible à qualifier.
- 20-49 : contact tiède / hors cible / incertain.
- 0-19 : aucun intérêt commercial (newsletter, interne, no-reply, spam, administratif).
score_reason : UNE phrase courte justifiant le score (ex: "DRH PME, demande de devis formation closing").
signals : extraits utiles si présents (role, company, buying_intent, budget_hint).`;

const TOOL: Anthropic.Tool = {
  name: "classify",
  description: "Classe un message entrant de l'inbox commerciale et score son intérêt commercial.",
  input_schema: {
    type: "object",
    properties: {
      category: { type: "string", enum: ["a", "b", "c"] },
      intent: { type: "string", enum: ["rdv", "devis", "question", "spam", "autre"] },
      interest_score: { type: "integer", minimum: 0, maximum: 100, description: "probabilité d'opportunité commerciale réelle (0-100)" },
      score_reason: { type: "string", description: "1 phrase justifiant le score" },
      signals: {
        type: "object",
        properties: {
          role: { type: "string" },
          company: { type: "string" },
          buying_intent: { type: "boolean" },
          budget_hint: { type: "string" },
        },
      },
    },
    required: ["category", "intent", "interest_score", "score_reason"],
  },
};

export interface ClassifyResult {
  category: Category;
  intent: Intent;
  interest_score: number;
  score_reason: string;
  signals?: { role?: string; company?: string; buying_intent?: boolean; budget_hint?: string | null };
}

export async function classifyConversation(conversationId: string): Promise<ClassifyResult | null> {
  const sb = svc();
  const { data: conv } = await sb.from("conversations").select("channel, subject").eq("id", conversationId).maybeSingle();
  const { data: msgs } = await sb.from("messages").select("body, direction").eq("conversation_id", conversationId)
    .order("created_at", { ascending: false }).limit(5);
  if (!conv || !msgs?.length) return null;

  const transcript = msgs.reverse().map((m) => `[${m.direction}] ${m.body}`).join("\n");
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 320,
    tool_choice: { type: "tool", name: "classify" },
    tools: [TOOL],
    messages: [{ role: "user", content: `Canal: ${conv.channel}\nSujet: ${conv.subject ?? "—"}\nMessages:\n${transcript}\n\n${RULES}` }],
  });
  const block = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!block) return null;
  const out = block.input as ClassifyResult;

  // Persist a/b/c+intent AND the score in one update. If the F P1 score columns aren't migrated
  // yet, the update errors → fall back to persisting only category/intent (which the leads agent
  // relies on) so there is NO regression on the proven agent path.
  const { error } = await sb.from("conversations")
    .update({ category: out.category, intent: out.intent, interest_score: out.interest_score, score_reason: out.score_reason ?? null })
    .eq("id", conversationId);
  if (error) {
    console.warn("[inbox.classify] score columns not persisted (migration applied?):", error.message);
    await sb.from("conversations").update({ category: out.category, intent: out.intent }).eq("id", conversationId);
  }
  return out;
}
