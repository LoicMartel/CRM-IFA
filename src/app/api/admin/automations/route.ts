import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyAdmin(): Promise<boolean> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: member } = await serviceClient
    .from("team_members")
    .select("roles")
    .eq("auth_user_id", user.id)
    .single();
  return ((member?.roles as string[]) ?? []).includes("Admin");
}

export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { data, error } = await serviceClient
    .from("automation_workflows")
    .select("*, automation_steps(*)")
    .order("category")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sort steps by step_order within each workflow
  const sorted = (data ?? []).map((w: any) => ({
    ...w,
    automation_steps: (w.automation_steps ?? []).sort((a: any, b: any) => a.step_order - b.step_order),
  }));

  return NextResponse.json(sorted);
}

export async function POST(req: Request) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const { name, slug, description, category, trigger_description, api_route } = body;

  if (!name || !slug || !category) {
    return NextResponse.json({ error: "name, slug, category required" }, { status: 400 });
  }

  const { data, error } = await serviceClient
    .from("automation_workflows")
    .insert({ name, slug, description, category, trigger_description, api_route })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
