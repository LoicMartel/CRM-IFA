import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Resend webhook events → recipient status mapping
const EVENT_STATUS_MAP: Record<string, { status: string; timestampField: string }> = {
  "email.delivered": { status: "delivered", timestampField: "delivered_at" },
  "email.opened": { status: "opened", timestampField: "opened_at" },
  "email.clicked": { status: "clicked", timestampField: "clicked_at" },
  "email.bounced": { status: "bounced", timestampField: "bounced_at" },
  "email.complained": { status: "complained", timestampField: "bounced_at" },
};

// Status priority: higher = more advanced in funnel
const STATUS_PRIORITY: Record<string, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  opened: 3,
  clicked: 4,
  bounced: 10,
  complained: 11,
  unsubscribed: 12,
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const eventType = body.type as string;
    const emailId = body.data?.email_id as string;

    if (!eventType || !emailId) {
      return NextResponse.json({ ok: true });
    }

    const mapping = EVENT_STATUS_MAP[eventType];
    if (!mapping) {
      return NextResponse.json({ ok: true });
    }

    // Find recipient by resend email ID
    const { data: recipient } = await supabase
      .from("campaign_recipients")
      .select("id, status")
      .eq("resend_email_id", emailId)
      .single();

    if (!recipient) {
      return NextResponse.json({ ok: true });
    }

    // Only update if new status is more advanced (don't go backwards)
    const currentPriority = STATUS_PRIORITY[recipient.status] ?? 0;
    const newPriority = STATUS_PRIORITY[mapping.status] ?? 0;

    if (newPriority > currentPriority) {
      await supabase.from("campaign_recipients").update({
        status: mapping.status,
        [mapping.timestampField]: new Date().toISOString(),
      }).eq("id", recipient.id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Resend webhook error:", err);
    return NextResponse.json({ ok: true });
  }
}
