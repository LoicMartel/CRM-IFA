import Anthropic from "@anthropic-ai/sdk";
import { svc } from "./ingest";
import type { Category, Intent } from "./types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RULES = `Catégories (choisis UNE):
- "a" = inutile / à ignorer : newsletters, promos, no-reply, spam, démarchage automatisé.
- "b" = à répondre : demande légitime non urgente (question, info, prise de contact).
- "c" = prioritaire : prospect chaud, demande de devis, RDV, client mécontent, opportunité commerciale.
Intent (choisis UN): "rdv", "devis", "question", "spam", "autre".`;

const TOOL: Anthropic.Tool = {
  name: "classify",
  description: "Classe un message entrant de l'inbox commerciale.",
  input_schema: {
    type: "object",
    properties: {
      category: { type: "string", enum: ["a", "b", "c"] },
      intent: { type: "string", enum: ["rdv", "devis", "question", "spam", "autre"] },
    },
    required: ["category", "intent"],
  },
};

export async function classifyConversation(conversationId: string): Promise<{ category: Category; intent: Intent } | null> {
  const sb = svc();
  const { data: conv } = await sb.from("conversations").select("channel, subject").eq("id", conversationId).maybeSingle();
  const { data: msgs } = await sb.from("messages").select("body, direction").eq("conversation_id", conversationId)
    .order("created_at", { ascending: false }).limit(5);
  if (!conv || !msgs?.length) return null;

  const transcript = msgs.reverse().map((m) => `[${m.direction}] ${m.body}`).join("\n");
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    tool_choice: { type: "tool", name: "classify" },
    tools: [TOOL],
    messages: [{ role: "user", content: `Canal: ${conv.channel}\nSujet: ${conv.subject ?? "—"}\nMessages:\n${transcript}\n\n${RULES}` }],
  });
  const block = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!block) return null;
  const out = block.input as { category: Category; intent: Intent };
  await sb.from("conversations").update({ category: out.category, intent: out.intent }).eq("id", conversationId);
  return out;
}
