import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const { campaign_id } = await req.json();
  if (!campaign_id) return NextResponse.json({ error: "campaign_id required" }, { status: 400 });

  // Get campaign
  const { data: campaign } = await supabase
    .from("marketing_campaigns")
    .select("*")
    .eq("id", campaign_id)
    .single();

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (campaign.status === "sent") return NextResponse.json({ error: "Already sent" }, { status: 400 });

  // Get recipients
  const { data: recipients } = await supabase
    .from("campaign_recipients")
    .select("id, email, contact_id")
    .eq("campaign_id", campaign_id)
    .eq("status", "pending");

  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ error: "No recipients" }, { status: 400 });
  }

  // Mark campaign as sending
  await supabase.from("marketing_campaigns").update({ status: "sending" }).eq("id", campaign_id);

  let sentCount = 0;
  const MIN_INTERVAL_MS = 300;

  // Send emails one by one to track each individually
  for (const r of recipients) {
    try {
      await new Promise(resolve => setTimeout(resolve, MIN_INTERVAL_MS));
      const { data } = await resend.emails.send({
        from: `${campaign.from_name} <${campaign.from_email}>`,
        to: [r.email],
        subject: campaign.subject,
        html: campaign.html_content,
        headers: {
          "X-Campaign-Id": campaign_id,
          "X-Recipient-Id": r.id,
        },
      });

      if (data?.id) {
        await supabase.from("campaign_recipients").update({
          resend_email_id: data.id,
          status: "sent",
          sent_at: new Date().toISOString(),
        }).eq("id", r.id);
        sentCount++;
      }
    } catch (err) {
      console.error(`Failed to send to ${r.email}:`, err);
      await supabase.from("campaign_recipients").update({
        status: "bounced",
        bounced_at: new Date().toISOString(),
      }).eq("id", r.id);
    }
  }

  // Mark campaign as sent
  await supabase.from("marketing_campaigns").update({
    status: "sent",
    sent_at: new Date().toISOString(),
    sent_count: sentCount,
  }).eq("id", campaign_id);

  return NextResponse.json({ sent: sentCount, total: recipients.length });
}
