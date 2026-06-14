import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { sendSessionEmail } from "@/lib/send-email";
import { loadWorkflow, isStepActive } from "@/lib/automations";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// CORS : endpoint public par design (formulaires landing/Webflow). Le CORS ne
// protège PAS des POST serveur-à-serveur — la vraie défense est la validation
// Zod ci-dessous. ACAO restreignable via LEADS_ALLOWED_ORIGIN (sinon *).
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": process.env.LEADS_ALLOWED_ORIGIN ?? "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Webhook-Secret",
};

// Authentification par agence (traçabilité + révocation), sans migration :
// LEADS_INBOUND_SECRETS = JSON { "agence-slug": "secret", ... }.
// - header X-Webhook-Secret présent → doit matcher un secret connu, sinon 401 ;
//   le slug d'agence matché devient le tag de source (mesure du ROI par agence).
// - header absent → chemin public legacy (Meta embed-forms / landing) inchangé.
function matchAgencySecret(secret: string | null): { slug: string } | null | "invalid" {
  if (!secret) return null; // legacy public path
  let map: Record<string, string> = {};
  try {
    const parsed = JSON.parse(process.env.LEADS_INBOUND_SECRETS ?? "{}");
    if (parsed && typeof parsed === "object") map = parsed;
  } catch {
    map = {};
  }
  const entry = Object.entries(map).find(([, v]) => v === secret);
  return entry ? { slug: entry[0] } : "invalid";
}

// Validation stricte de l'input (anti-injection / payload bomb).
const leadSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  website: z.string().trim().max(300).optional().or(z.literal("")),
  source: z.string().trim().max(100).optional().or(z.literal("")),
  clientType: z.string().trim().max(100).optional().or(z.literal("")),
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  try {
    const agency = matchAgencySecret(request.headers.get("x-webhook-secret"));
    if (agency === "invalid") {
      return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401, headers: CORS_HEADERS });
    }
    const agencySlug = agency?.slug ?? null;

    const raw = await request.json();
    const parsed = leadSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400, headers: CORS_HEADERS },
      );
    }
    const { firstName, lastName, email, phone, website, source, clientType } = parsed.data;
    // Source effective : l'agence authentifiée prime sur le champ `source` du payload.
    const effectiveSource = agencySlug ?? source ?? "";

    const wf = await loadWorkflow("landing-page-lead");
    if (wf && !wf.is_active) {
      return NextResponse.json({ skipped: true, reason: "workflow disabled" }, { headers: CORS_HEADERS });
    }

    // 1. Find or create company from website URL
    let companyId: string | null = null;
    if (website && isStepActive(wf, "create-update-company").active) {
      const { data: existingCompany } = await supabase
        .from("companies")
        .select("id")
        .ilike("website", `%${website}%`)
        .maybeSingle();

      if (existingCompany) {
        companyId = existingCompany.id;
      } else {
        // Extract company name from URL (remove www., .com, .fr, etc.)
        const companyName = website
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "")
          .replace(/\.[a-z]{2,}$/i, "")
          .replace(/\.[a-z]{2,}$/i, "");

        const { data: newCompany } = await supabase
          .from("companies")
          .insert({
            name: companyName,
            website,
            lifecycle_stage: "prospect",
          })
          .select("id")
          .single();
        companyId = newCompany?.id ?? null;
      }
    }

    // 2. Find or create contact
    let contactId: string | null = null;
    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    let resolvedSourceId = source === "embed-form"
      ? "59ab5fc4-e4f6-43c4-b327-61a90001ae16"   // Meta ads - tunnel commercial
      : source === "embed-form-book"
      ? "15e8fa54-6540-43e5-902a-3231e1522e44"    // Meta ads - tunnel book
      : null;

    // Lead provenant d'une agence authentifiée : rattacher à la lead_source du même nom
    // (à créer côté CRM par Loïc) pour mesurer le ROI par agence. Si aucune ligne ne matche,
    // le slug reste tracé via notes/source string (pas de blocage).
    if (!resolvedSourceId && agencySlug) {
      const { data: ls } = await supabase.from("lead_sources").select("id").ilike("name", agencySlug).maybeSingle();
      resolvedSourceId = ls?.id ?? null;
    }

    const sourceLabel = agencySlug
      ? `Agence : ${agencySlug}`
      : source === "embed-form" ? "Meta ads - tunnel commercial"
      : source === "embed-form-book" ? "Meta ads - tunnel book"
      : source || "Landing Page";

    if (existingContact) {
      // Update existing contact (including name in case it changed on re-submission)
      await supabase.from("contacts").update({
        first_name: firstName,
        last_name: lastName,
        phone: phone || undefined,
        company_id: companyId || undefined,
        lifecycle_stage: "lead_marketing",
        lead_status: "lead",
        was_lead_marketing: true,
        ...(resolvedSourceId ? { source_id: resolvedSourceId } : {}),
      }).eq("id", existingContact.id);
      contactId = existingContact.id;
    } else {
      const { data: newContact } = await supabase
        .from("contacts")
        .insert({
          first_name: firstName,
          last_name: lastName,
          email,
          phone: phone || null,
          company_id: companyId,
          contact_type: "inbound",
          lifecycle_stage: "lead_marketing",
          was_lead_marketing: true,
          lead_status: "lead",
          source_id: resolvedSourceId,
          notes: `Source: ${sourceLabel}\nType: ${clientType || "—"}\nSite web: ${website || "—"}`,
        })
        .select("id")
        .single();
      contactId = newContact?.id ?? null;
    }

    // 3. Send email notification to Alexandre, Rafi and Loïc
    const LEAD_NOTIFY_EMAILS = [
      "alexandre@closing-academie.com",
      "rafi@closing-academie.com",
      "loic@closing-academie.com",
    ];

    const notifSubject = `Nouveau lead marketing — ${firstName} ${lastName}`;
    const notifBody = [
      `Un nouveau lead vient d'arriver via la landing page :`,
      "",
      `👤 ${firstName} ${lastName}`,
      `✉️ ${email}`,
      phone ? `📞 ${phone}` : "",
      website ? `🌐 ${website}` : "",
      `📣 Source : ${sourceLabel}`,
      "",
      `Le contact a été créé automatiquement dans le CRM avec le statut "Lead Marketing".`,
      "",
      `👉 https://crm-lca.vercel.app/contacts/${contactId}`,
    ].filter(Boolean).join("\n");

    const emailPromises = LEAD_NOTIFY_EMAILS.map((to) =>
      sendSessionEmail({ to, subject: notifSubject, body: notifBody })
    );
    if (emailPromises.length > 0) await Promise.all(emailPromises);

    // In-app notifications for Alexandre, Rafi and Loïc
    const { data: notifTargets } = await supabase
      .from("team_members")
      .select("id, email")
      .in("email", LEAD_NOTIFY_EMAILS);
    if (notifTargets && notifTargets.length > 0) {
      const notifRows = notifTargets.map((m: { id: string; email: string }) => ({
        recipient_id: m.id,
        type: "new_lead",
        title: `Nouveau lead : ${firstName} ${lastName}`,
        body: `${sourceLabel}${website ? ` — ${website}` : ""}`,
        link_url: `/contacts/${contactId}`,
        related_entity_type: "contact",
        related_entity_id: contactId,
      }));
      if (notifRows.length > 0) await supabase.from("notifications").insert(notifRows);
    }

    // 4. Send thank-you email with book PDF for book-related sources
    if ((source === "landing-book-financement" || source === "embed-form-book") && email && isStepActive(wf, "send-book-pdf").active) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://crm-lca.vercel.app";
        const pdfRes = await fetch(`${baseUrl}/book-financement-gratuit.pdf`);
        if (!pdfRes.ok) throw new Error(`PDF fetch failed: ${pdfRes.status}`);
        const pdfBuffer = await pdfRes.arrayBuffer();
        const pdfContent = Buffer.from(pdfBuffer);

        await sendSessionEmail({
          to: email,
          subject: "Votre Book Financements 2026 est prêt !",
          body: [
            `Bonjour ${firstName},`,
            "",
            "Merci pour votre intérêt ! Votre Book Financements édition 2026 est disponible en pièce jointe.",
            "",
            "Dans ce guide, vous découvrirez :",
            "",
            "• Comment intégrer les financements dans votre discours commercial",
            "• Comment identifier les bons dispositifs selon vos prospects",
            "• Comment transformer un « je n'ai pas le budget » en solution",
            "• Un premier dispositif détaillé : le PDC OPCO",
            "",
            "Ce book a été conçu pour les dirigeants d'organismes de formation et les responsables commerciaux qui souhaitent aider leurs clients à s'offrir leurs formations.",
            "",
            "Pour aller plus loin et accéder à la version complète avec tous les dispositifs (OPCO, FAF, CPF, France Travail...), une méthode claire et une stratégie commerciale fondée sur les financements :",
            "https://buy.stripe.com/bJedR8dso89x6vd2MqfYY07",
            "",
            "Si vous avez la moindre question, n'hésitez pas à nous répondre directement.",
            "",
            "À très bientôt,",
            "",
            "L'équipe La Closing Académie",
          ].join("\n"),
          attachments: [{ filename: "Book-Financements-2026.pdf", content: pdfContent, contentType: "application/pdf" }],
        });
      } catch {
        // Email is best-effort, don't block the response
      }
    }

    // Inbox agent pipeline: a web-form lead becomes a conversation the agent contacts.
    // Speed-to-lead: on un lead "fiche" éligible, on envoie un message d'accueil fixe
    // signé Rafi (avec lien RDV) immédiatement — pas de tour LLM (0 latence). L'agent
    // dynamique (runAgentTurn) prend le relais quand le lead répond.
    try {
      const { ingestIncoming, svc } = await import("@/lib/inbox/ingest");
      const { classifyConversation } = await import("@/lib/inbox/classify");
      const { evaluateEligibility } = await import("@/lib/inbox/eligibility");
      const { sendGreeting } = await import("@/lib/inbox/agent");
      const { resolveInboxAccount } = await import("@/lib/inbox/routing");
      const body = `Nouveau lead via formulaire (${effectiveSource || "site"}).`;
      // external_chat_id déterministe par email → une re-soumission du même lead réutilise
      // la conversation existante (au lieu d'en recréer une) ; l'index unique partiel
      // conversations_chat_uniq + le handling 23505 dédupent aussi les soumissions concurrentes.
      const webformChatId = `webform-${parsed.data.email.trim().toLowerCase()}`;
      const result = await ingestIncoming({
        channel: "web_form", direction: "inbound", accountId: null, externalChatId: webformChatId,
        externalMessageId: `webform-${parsed.data.email.trim().toLowerCase()}-${Date.now()}`,
        senderName: `${parsed.data.firstName} ${parsed.data.lastName}`,
        senderHandle: parsed.data.email, body, subject: "Lead formulaire web",
        contactId,
      });
      // Greeting UNIQUEMENT sur une conversation neuve → un seul message d'accueil par lead,
      // jamais de doublon sur re-submit / double-clic / retry / rejeu webhook.
      if (result && result.direction === "inbound" && result.isNewConversation) {
        // Routage account_id (socle F+C) : un web_form n'a pas d'account_id → mode 'agent' (chantier D).
        // On résout explicitement pour ne jamais répondre depuis un mode non-agent si ce endpoint
        // venait à porter un account_id un jour (sécurité = même invariant qu'au webhook Unipile).
        const { mode } = await resolveInboxAccount(null);
        if (mode === "agent") {
          await classifyConversation(result.conversationId).catch(() => {});
          const v = await evaluateEligibility(result.conversationId, result.isExistingContact, "web_form", body);
          if (v.eligible) {
            await svc().from("conversations").update({ agent_status: "active" }).eq("id", result.conversationId);
            await sendGreeting(result.conversationId).catch(() => {});
          }
        }
      }
    } catch (e) { console.error("[leads/inbound] inbox pipeline failed:", e); }

    return NextResponse.json({ success: true, contactId }, { headers: CORS_HEADERS });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500, headers: CORS_HEADERS });
  }
}
