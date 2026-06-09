import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { svc } from "@/lib/inbox/ingest";
import { resolvePersona } from "@/lib/inbox/routing";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = svc();
  const { data: conv } = await sb.from("conversations").select("account_id").eq("id", id).maybeSingle();
  const { data: msgs } = await sb.from("messages").select("body, sent_by").eq("conversation_id", id)
    .order("created_at", { ascending: false }).limit(6);
  if (!msgs?.length) return NextResponse.json({ error: "empty" }, { status: 404 });
  const transcript = msgs.reverse().map((m) => `[${m.sent_by}] ${m.body}`).join("\n");

  // Persona-driven (de-hardcoded): name/signature resolved per owner/account; voice profile (F P2) appended when set.
  const persona = await resolvePersona(conv?.account_id ?? null);
  const voiceBlock = persona.voiceProfile ? `\n\nVOICE PROFILE — rédige en respectant ce style:\n${persona.voiceProfile}` : "";
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6", max_tokens: 500,
    system: `Rédige au nom de ${persona.displayName} (La Closing Académie) une réponse courte, pro et chaleureuse en français. Signe "${persona.signature}".${voiceBlock}`,
    messages: [{ role: "user", content: `Échange:\n${transcript}\n\nRédige la réponse.` }],
  });
  const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
  return NextResponse.json({ ok: true, draft: text });
}
