import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: conversation } = await sb.from("conversations")
    .select("*, contacts(id,first_name,last_name,email,phone)").eq("id", id).maybeSingle();
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: messages } = await sb.from("messages").select("*").eq("conversation_id", id).order("created_at", { ascending: true });
  await sb.from("conversations").update({ unread: false }).eq("id", id);
  return NextResponse.json({ conversation, messages: messages ?? [] });
}
