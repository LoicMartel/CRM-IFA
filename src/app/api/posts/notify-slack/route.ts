import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSlackToken } from "@/lib/oauth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { recipientIds, authorName, postTitle, tagLabels, postId, type } = await req.json();

    if (!recipientIds?.length) {
      return NextResponse.json({ success: true, skipped: true });
    }

    // Fetch slack_user_id for all recipients
    const { data: members } = await supabase
      .from("team_members")
      .select("id, first_name, slack_user_id")
      .in("id", recipientIds);

    const results: { member: string; status: string }[] = [];
    const postUrl = `https://crm-lca.vercel.app/posts#post-${postId}`;

    for (const m of members ?? []) {
      if (!m.slack_user_id) continue;

      const memberSlackToken = await getSlackToken(m.id);
      if (!memberSlackToken) continue;

      let msg: string;
      if (type === "mention_post") {
        msg = [
          `Bonjour ${m.first_name},`,
          "",
          `💬 *${authorName} t'a mentionné dans un post*`,
          "",
          `*${postTitle}*`,
          "",
          `👉 <${postUrl}|Voir le post>`,
        ].join("\n");
      } else if (type === "mention_comment") {
        msg = [
          `Bonjour ${m.first_name},`,
          "",
          `💬 *${authorName} t'a mentionné dans un commentaire*`,
          "",
          `Sur le post : *${postTitle}*`,
          "",
          `👉 <${postUrl}|Voir le post>`,
        ].join("\n");
      } else {
        msg = [
          `Bonjour ${m.first_name},`,
          "",
          `📝 *Nouveau post tagué ${tagLabels}*`,
          "",
          `*${postTitle}*`,
          `Par ${authorName}`,
          "",
          `👉 <${postUrl}|Voir le post>`,
        ].join("\n");
      }

      try {
        const res = await fetch("https://slack.com/api/chat.postMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${memberSlackToken}` },
          body: JSON.stringify({ channel: m.slack_user_id, text: msg }),
        });
        const data = await res.json();
        results.push({ member: m.first_name, status: data.ok ? "sent" : data.error });
      } catch (e: any) {
        results.push({ member: m.first_name, status: e.message });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
