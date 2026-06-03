import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { svc } from "@/lib/inbox/ingest";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = svc();
  const { data: msgs } = await sb.from("messages").select("body, sent_by").eq("conversation_id", id)
    .order("created_at", { ascending: false }).limit(6);
  if (!msgs?.length) return NextResponse.json({ error: "empty" }, { status: 404 });
  const transcript = msgs.reverse().map((m) => `[${m.sent_by}] ${m.body}`).join("\n");

  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 500,
    system: `Rédige au nom de Rafi (La Closing Académie) une réponse courte, pro et chaleureuse en français. Signe "Rafi — La Closing Académie".`,
    messages: [{ role: "user", content: `Échange:\n${transcript}\n\nRédige la réponse.` }],
  });
  const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
  return NextResponse.json({ ok: true, draft: text });
}
