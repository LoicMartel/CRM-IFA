import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { svc } from "@/lib/inbox/ingest";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await svc().from("conversations").update({ agent_status: "human" }).eq("id", id);
  return NextResponse.json({ ok: true });
}
