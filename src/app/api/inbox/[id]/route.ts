import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: conversation } = await sb.from("conversations")
    .select("*, contacts(id,first_name,last_name,email,phone,source_id)").eq("id", id).maybeSingle();
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Libellé lisible de la source du lead (Meta ads tunnel book/commercial…) pour l'afficher dans le thread.
  let source_label: string | null = null;
  const contact = Array.isArray(conversation.contacts) ? conversation.contacts[0] : conversation.contacts;
  if (contact?.source_id) {
    const { data: src } = await sb.from("lead_sources").select("name").eq("id", contact.source_id).maybeSingle();
    source_label = src?.name ?? null;
  }

  const { data: messages } = await sb.from("messages").select("*").eq("conversation_id", id).order("created_at", { ascending: true });
  await sb.from("conversations").update({ unread: false }).eq("id", id);
  return NextResponse.json({ conversation, messages: messages ?? [], source_label });
}
