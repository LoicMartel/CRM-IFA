import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const { memberId } = await req.json();
    if (!memberId) {
      return NextResponse.json({ error: "memberId requis" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Get the member to find their auth_user_id
    const { data: member } = await supabase
      .from("team_members")
      .select("id, auth_user_id, first_name, last_name")
      .eq("id", memberId)
      .single();

    if (!member) {
      return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
    }

    // 2. Delete the Supabase Auth user (revokes all access)
    if (member.auth_user_id) {
      const { error: authError } = await supabase.auth.admin.deleteUser(member.auth_user_id);
      if (authError) {
        console.error("Error deleting auth user:", authError);
        // Continue anyway — we still want to deactivate the member
      }
    }

    // 3. NULL out FK references on active records so they can be reassigned
    await Promise.all([
      supabase.from("contacts").update({ owner_id: null }).eq("owner_id", memberId),
      supabase.from("companies").update({ owner_id: null }).eq("owner_id", memberId),
      supabase.from("deals").update({ owner_id: null }).eq("owner_id", memberId),
      supabase.from("meetings").update({ assigned_to: null }).eq("assigned_to", memberId),
      supabase.from("opportunities").update({ sales_id: null }).eq("sales_id", memberId),
      supabase.from("leads").update({ sales_id: null }).eq("sales_id", memberId),
    ]);

    // 4. Deactivate the team member (preserves historical data in activities, sessions, etc.)
    await supabase
      .from("team_members")
      .update({ is_active: false, auth_user_id: null })
      .eq("id", memberId);

    return NextResponse.json({
      success: true,
      message: `${member.first_name} ${member.last_name} a été supprimé(e) et ses accès ont été révoqués.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
