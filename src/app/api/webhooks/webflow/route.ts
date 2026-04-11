import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { loadWorkflow, isStepActive } from "@/lib/automations";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const WEBFLOW_SECRET = process.env.WEBFLOW_WEBHOOK_SECRET ?? "";

// Pauline's team member ID
const PAULINE_ID = "55e425cb-5041-4ea4-92c3-ce2f1dbce6a0";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // Verify Webflow signature if secret is set
    if (WEBFLOW_SECRET) {
      const signature = req.headers.get("x-webflow-signature");
      if (signature) {
        const expected = crypto.createHmac("sha256", WEBFLOW_SECRET).update(rawBody).digest("hex");
        if (signature !== expected) {
          console.error("Webflow webhook: invalid signature");
          return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }
      }
    }

    const body = JSON.parse(rawBody);

    // Webflow API V2 form submission format:
    // { payload: { formId, submittedAt, formResponse: { "field-id": { ... }, ... } } }
    // OR legacy: { data: { "Prénom": "...", ... } }
    // We handle both + log the raw body for debugging

    console.log("Webflow webhook raw body:", JSON.stringify(body));

    let firstName = "";
    let lastName = "";
    let email = "";
    let phone = "";
    let companyUrl = "";

    // Try V2 format first (formResponse with field objects)
    const formResponse = body.payload?.formResponse;
    if (formResponse) {
      // V2: fields are keyed by field ID, each has { displayName, type, textValue/objectValue }
      for (const field of Object.values(formResponse) as any[]) {
        const name = (field.displayName ?? "").toLowerCase();
        const value = field.textValue ?? field.objectValue ?? "";
        if (name.includes("prénom") || name.includes("prenom") || name === "first name") firstName = value;
        else if (name.includes("nom") && !name.includes("prénom") && !name.includes("prenom")) lastName = value;
        else if (name.includes("email") || name.includes("mail")) email = value;
        else if (name.includes("téléphone") || name.includes("telephone") || name.includes("phone")) phone = value;
        else if (name.includes("url") || name.includes("société") || name.includes("societe")) companyUrl = value;
      }
    }

    // Fallback: legacy / flat format
    if (!email) {
      const data = body.data ?? body.payload?.data ?? body;
      firstName = firstName || (data["Prénom"] ?? data["prenom"] ?? data["Pr-nom"] ?? data["first_name"] ?? data["firstName"] ?? "");
      lastName = lastName || (data["Nom"] ?? data["nom"] ?? data["last_name"] ?? data["lastName"] ?? "");
      email = data["Email"] ?? data["email"] ?? data["e-mail"] ?? "";
      phone = phone || (data["Numéro de téléphone"] ?? data["Num-ro-de-t-l-phone"] ?? data["phone"] ?? data["telephone"] ?? data["tel"] ?? "");
      companyUrl = companyUrl || (data["URL de la société"] ?? data["URL-de-la-soci-t"] ?? data["company_url"] ?? data["url"] ?? "");
    }

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const wf = await loadWorkflow("webflow-form");
    if (wf && !wf.is_active) {
      return NextResponse.json({ skipped: true, reason: "workflow disabled" });
    }

    // Check if contact already exists
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (!isStepActive(wf, "create-update-contact").active) {
      return NextResponse.json({ ok: true, skipped: "contact step disabled" });
    }

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
    if (companyUrl && isStepActive(wf, "match-company").active) {
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
