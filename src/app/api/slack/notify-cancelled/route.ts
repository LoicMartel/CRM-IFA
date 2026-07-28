import { NextRequest, NextResponse } from "next/server";
import { getSlackToken } from "@/lib/oauth";

const IMAN_SLACK_USER_ID = "U06AGJG5FQE";

export async function POST(req: NextRequest) {
  try {
    const { companyName, sessionDate, sessionType, duration, trainers, notes } = await req.json();

    const slackToken = await getSlackToken(); // bot token fallback (no specific member)
    if (!slackToken) {
      return NextResponse.json({ error: "Slack not configured" }, { status: 500 });
    }

    const message = [
      `Bonjour Iman,`,
      ``,
      `Une session de formation vient d'être annulée :`,
      ``,
      `*Entreprise :* ${companyName || "—"}`,
      `*Date :* ${sessionDate || "—"}`,
      `*Type :* ${sessionType}${duration ? ` (${duration})` : ""}`,
      `*Trainer :* ${trainers || "—"}`,
      notes ? `*Raison :* ${notes}` : "",
      ``,
      `<https://crm-lca.vercel.app/planning|Voir sur le CRM →>`,
    ].filter(Boolean).join("\n");

    const slackRes = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${slackToken}`,
      },
      body: JSON.stringify({
        channel: IMAN_SLACK_USER_ID,
        text: message,
      }),
    });

    const slackData = await slackRes.json();

    return NextResponse.json({
      success: slackData.ok,
      error: slackData.ok ? undefined : slackData.error,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
