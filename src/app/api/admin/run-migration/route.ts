import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "public" } }
  );

  // We can't run DDL via PostgREST, so we use a workaround:
  // Create an RPC function first, then call it
  // Instead, let's just check if the column exists by trying to select it
  const { error } = await supabase.from("team_members").select("avatar_url").limit(1);

  if (error && error.message.includes("avatar_url")) {
    return NextResponse.json({ status: "Column avatar_url needs to be created manually in Supabase Dashboard SQL editor", sql: "ALTER TABLE team_members ADD COLUMN IF NOT EXISTS avatar_url text;" });
  }

  return NextResponse.json({ status: "Column avatar_url already exists" });
}
