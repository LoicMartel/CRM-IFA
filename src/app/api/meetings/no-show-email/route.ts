import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSessionEmail } from "@/lib/send-email";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { contactId } = await req.json();

    if (!contactId) {
      return NextResponse.json({ error: "contactId required" }, { status: 400 });
    }

    const { data: contact } = await supabase
      .from("contacts")
      .select("id, first_name, email")
      .eq("id", contactId)
      .single();

    if (!contact || !contact.email) {
      return NextResponse.json({ error: "Contact not found or no email" }, { status: 404 });
    }

    const bookingUrl = "https://crm-lca.vercel.app/booking";

    const htmlBody = `
<h2 style="color: #FF6B35; margin-bottom: 20px;">On s'est manqués !</h2>

<p>Bonjour ${contact.first_name},</p>

<p>Nous avions rendez-vous aujourd'hui et nous n'avons malheureusement pas pu échanger.</p>

<p>Je pense qu'un événement imprévu est arrivé qui vous a fait manquer notre bilan. Pour sélectionner un nouveau créneau et ne pas perdre cette opportunité, cliquez ci-dessous :</p>

<p style="text-align: center; margin: 24px 0;">
  <a href="${bookingUrl}" style="display: inline-block; padding: 14px 28px; border-radius: 8px; background: #FF6B35; color: white; font-size: 14px; font-weight: 700; text-decoration: none;">
    Réserver un nouveau bilan
  </a>
</p>

<p>À très vite,</p>
`;

    const result = await sendSessionEmail({
      to: contact.email,
      subject: "On s'est manqués !",
      body: htmlBody,
      isHtml: true,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, sentTo: contact.email });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
