import { createClient } from "@/lib/supabase/server";
import { HomeView } from "@/components/dashboard/home-view";

export default async function HomePage() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  // Get current user's team_member_id
  const { data: { user } } = await supabase.auth.getUser();
  let currentMemberId: string | null = null;
  let memberFirstName = "";

  if (user) {
    const { data: member } = await supabase
      .from("team_members")
      .select("id, first_name")
      .eq("auth_user_id", user.id)
      .single();

    if (member) {
      currentMemberId = member.id;
      memberFirstName = member.first_name;
    } else {
      // Fallback by email
      const { data: memberByEmail } = await supabase
        .from("team_members")
        .select("id, first_name")
        .eq("email", user.email)
        .single();
      if (memberByEmail) {
        currentMemberId = memberByEmail.id;
        memberFirstName = memberByEmail.first_name;
      }
    }
  }

  // Sales targets & deals (global, not filtered by member)
  const [
    { data: salesTargets },
    { data: wonDeals },
  ] = await Promise.all([
    supabase.from("sales_targets").select("*").order("month", { ascending: true }),
    supabase.from("deals").select("id, amount, close_date, created_at").eq("stage", "closed_won"),
  ]);

  // Personal data — filtered by current member
  let todayMeetings: any[] = [];
  let todaySessions: any[] = [];
  let todayTasks: any[] = [];
  let upcomingMeetings: any[] = [];
  let upcomingSessions: any[] = [];
  let overdueTasks: any[] = [];

  if (currentMemberId) {
    const [
      { data: tm },
      { data: ts },
      { data: tt },
      { data: um },
      { data: us },
      { data: ot },
    ] = await Promise.all([
      // Today meetings assigned to me
      supabase.from("meetings").select("*, contacts!meetings_contact_id_fkey(first_name, last_name), companies:company_id(name), team_members!meetings_assigned_to_fkey(first_name, last_name)")
        .eq("assigned_to", currentMemberId)
        .gte("scheduled_at", `${today}T00:00:00`)
        .lte("scheduled_at", `${today}T23:59:59`)
        .eq("status", "booked")
        .order("scheduled_at", { ascending: true }),

      // Today sessions where I'm a trainer (trainers is a text[] containing first names)
      supabase.from("training_sessions").select("*, service_plans(hourly_rate, companies(name), training_programs(name)), training_session_learners(learner_id, learners(id, first_name, last_name))")
        .eq("session_date", today)
        .neq("status", "cancelled")
        .contains("trainers", [memberFirstName])
        .order("session_time", { ascending: true }),

      // Today tasks assigned to me
      supabase.from("activities").select("*, contacts:contact_id(first_name, last_name), learners:learner_id(first_name, last_name)")
        .eq("type", "tâche")
        .eq("is_completed", false)
        .eq("team_member_id", currentMemberId)
        .not("due_date", "is", null)
        .gte("due_date", `${today}T00:00:00`)
        .lte("due_date", `${today}T23:59:59`)
        .order("due_date", { ascending: true }),

      // Upcoming meetings assigned to me
      supabase.from("meetings").select("*, contacts!meetings_contact_id_fkey(first_name, last_name), team_members!meetings_assigned_to_fkey(first_name, last_name)")
        .eq("assigned_to", currentMemberId)
        .gt("scheduled_at", `${today}T23:59:59`)
        .eq("status", "booked")
        .order("scheduled_at", { ascending: true })
        .limit(5),

      // Upcoming sessions where I'm a trainer
      supabase.from("training_sessions").select("*, service_plans(hourly_rate, companies(name), training_programs(name)), training_session_learners(learner_id, learners(id, first_name, last_name))")
        .gt("session_date", today)
        .neq("status", "cancelled")
        .contains("trainers", [memberFirstName])
        .order("session_date", { ascending: true })
        .limit(5),

      // Overdue tasks assigned to me
      supabase.from("activities").select("*, contacts:contact_id(first_name, last_name), learners:learner_id(first_name, last_name)")
        .eq("type", "tâche")
        .eq("is_completed", false)
        .eq("team_member_id", currentMemberId)
        .not("task_deadline", "is", null)
        .lte("task_deadline", today)
        .order("task_deadline", { ascending: true }),
    ]);

    todayMeetings = tm ?? [];
    todaySessions = ts ?? [];
    todayTasks = tt ?? [];
    upcomingMeetings = um ?? [];
    upcomingSessions = us ?? [];
    overdueTasks = ot ?? [];
  }

  // Fetch all VT sessions (minimal) for progression display (VT 2/12)
  const { data: allVtSessions } = await supabase
    .from("training_sessions")
    .select("id, service_plan_id, status, session_date")
    .eq("session_type", "vt")
    .neq("status", "cancelled")
    .order("session_date", { ascending: true });

  return (
    <div className="p-6">
      <HomeView
        memberFirstName={memberFirstName}
        currentMemberId={currentMemberId}
        salesTargets={salesTargets ?? []}
        wonDeals={wonDeals ?? []}
        todayMeetings={todayMeetings}
        todaySessions={todaySessions}
        todayTasks={todayTasks}
        upcomingMeetings={upcomingMeetings}
        upcomingSessions={upcomingSessions}
        overdueTasks={overdueTasks}
        allVtSessions={allVtSessions ?? []}
      />
    </div>
  );
}
