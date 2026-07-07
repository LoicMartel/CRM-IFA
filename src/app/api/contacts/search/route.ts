import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const companyId = req.nextUrl.searchParams.get("company_id") ?? "";

  const supabase = await createClient();

  let query = supabase
    .from("contacts")
    .select("id, first_name, last_name, company_id")
    .order("last_name");

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  if (q.trim()) {
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
  }

  const { data, error } = await query.limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
