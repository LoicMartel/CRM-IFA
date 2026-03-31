import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Pauline's team member ID
const PAULINE_ID = "55e425cb-5041-4ea4-92c3-ce2f1dbce6a0";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Webflow form submissions come in different formats depending on the integration
    // Try to extract fields flexibly
    const data = body.data ?? body.payload?.data ?? body;

    // Extract form fields (Webflow sends field names or IDs)
    const firstName = data["Prénom"] ?? data["prenom"] ?? data["Pr-nom"] ?? data["first_name"] ?? data["firstName"] ?? "";
    const lastName = data["Nom"] ?? data["nom"] ?? data["last_name"] ?? data["lastName"] ?? "";
    const email = data["Email"] ?? data["email"] ?? data["e-mail"] ?? "";
    const phone = data["Numéro de téléphone"] ?? data["Num-ro-de-t-l-phone"] ?? data["phone"] ?? data["telephone"] ?? data["tel"] ?? "";
    const companyUrl = data["URL de la société"] ?? data["URL-de-la-soci-t"] ?? data["company_url"] ?? data["url"] ?? "";

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    // Check if contact already exists
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (existing) {
      // Contact exists, update lifecycle_stage if still a basic lead
      await supabase.from("contacts").update({
        lifecycle_stage: "lead_marketing",
        phone: phone || undefined,
      }).eq("id", existing.id);

      return NextResponse.json({ ok: true, contact_id: existing.id, action: "updated" });
    }

    // Create new contact as Lead Marketing
    const { data: contact, error } = await supabase.from("contacts").insert({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.toLowerCase().trim(),
      phone: phone || null,
      lifecycle_stage: "lead_marketing",
      lead_status: "lead",
      contact_type: "inbound",
      owner_id: PAULINE_ID,
      notes: companyUrl ? `Site web : ${companyUrl}` : null,
    }).select("id").single();

    if (error) {
      console.error("Webflow webhook - insert error:", error);
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }

    // Try to match or create a company from the URL
    if (companyUrl) {
      const domain = companyUrl.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
      if (domain) {
        // Check if company exists with this website
        const { data: existingCompany } = await supabase
          .from("companies")
          .select("id")
          .ilike("website", `%${domain}%`)
          .maybeSingle();

        if (existingCompany) {
          await supabase.from("contacts").update({ company_id: existingCompany.id }).eq("id", contact.id);
        }
      }
    }

    return NextResponse.json({ ok: true, contact_id: contact.id, action: "created" });
  } catch (err) {
    console.error("Webflow webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
