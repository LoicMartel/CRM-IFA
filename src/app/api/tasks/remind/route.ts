import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { loadWorkflow } from "@/lib/automations";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const slackToken = process.env.SLACK_BOT_TOKEN;

    if (!slackToken) {
      return NextResponse.json({ error: "SLACK_BOT_TOKEN not configured" }, { status: 500 });
    }

    const wf = await loadWorkflow("task-reminders");
    if (wf && !wf.is_active) {
      return NextResponse.json({ success: true, message: "workflow disabled", count: 0 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Yesterday's date (tasks whose deadline was yesterday are now overdue)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    // Fetch overdue tasks: not completed, deadline was yesterday
    const { data: overdueTasks, error } = await supabase
      .from("activities")
      .select("id, title, task_deadline, team_member_id, contacts:contact_id(id, first_name, last_name)")
      .eq("type", "tâche")
      .eq("is_completed", false)
      .eq("task_deadline", yesterdayStr);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!overdueTasks || overdueTasks.length === 0) {
      return NextResponse.json({ success: true, message: "No overdue tasks", count: 0 });
    }

    // Get all unique team member IDs
    const memberIds = [...new Set(overdueTasks.filter(t => t.team_member_id).map(t => t.team_member_id!))];

    // Fetch team members with slack_user_id
    const { data: teamMembers } = await supabase
      .from("team_members")
      .select("id, first_name, last_name, slack_user_id")
      .in("id", memberIds.length > 0 ? memberIds : ["__none__"]);

    const memberMap = new Map((teamMembers ?? []).map(m => [m.id, m]));

    const results: { task: string; member: string; status: string }[] = [];

    for (const task of overdueTasks) {
      if (!task.team_member_id) {
        results.push({ task: task.title, member: "non assigné", status: "skipped" });
        continue;
      }

      const member = memberMap.get(task.team_member_id);
      if (!member || !member.slack_user_id) {
        results.push({ task: task.title, member: member?.first_name ?? "inconnu", status: "no slack id" });
        continue;
      }

      const contact = task.contacts as any;
      const contactName = contact ? `${contact.first_name} ${contact.last_name}` : "Contact inconnu";
      const deadlineFormatted = task.task_deadline ?? yesterdayStr;

      const message = `⚠️ Rappel urgent — La tâche '${task.title}' pour ${contactName} a dépassé son échéance (${deadlineFormatted}). Merci de la traiter en priorité.`;

      try {
        const slackRes = await fetch("https://slack.com/api/chat.postMessage", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${slackToken}`,
          },
          body: JSON.stringify({
            channel: member.slack_user_id,
            text: message,
          }),
        });
        const slackData = await slackRes.json();
        results.push({
          task: task.title,
          member: member.first_name,
          status: slackData.ok ? "sent" : slackData.error,
        });
      } catch (e: any) {
        results.push({
          task: task.title,
          member: member.first_name,
          status: `error: ${e.message}`,
        });
      }
    }

    return NextResponse.json({ success: true, count: overdueTasks.length, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
