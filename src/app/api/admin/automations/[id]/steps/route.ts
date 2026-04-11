import { NextRequest, NextResponse } from "next/server";
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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const { name, slug, description, step_type, step_order, config } = body;

  if (!name || !slug || !step_type) {
    return NextResponse.json({ error: "name, slug, step_type required" }, { status: 400 });
  }

  const { data, error } = await serviceClient
    .from("automation_steps")
    .insert({
      workflow_id: id,
      name,
      slug,
      description,
      step_type,
      step_order: step_order ?? 0,
      config: config ?? {},
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
