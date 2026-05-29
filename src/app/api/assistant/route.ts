import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { requireMember } from "@/lib/api-auth";

// Garde-fou anti-boucle : nombre max d'allers-retours tool_use par requête.
const MAX_TOOL_ITERATIONS = 8;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const SYSTEM_PROMPT = `Tu es l'assistant IA du CRM de La Closing Académie. Ton emoji est 🧙‍♂️.
Tu es à la fois :
1. **Un assistant CRM** : tu aides les utilisateurs à naviguer, créer des contacts, des RDV, chercher des infos.
2. **Un coach commercial** : tu donnes des conseils de vente, des techniques de closing, des tips pour améliorer les performances commerciales. Tu connais les méthodes de vente consultative, SPIN selling, la gestion des objections.
3. **Un coach personnel** : tu motives, tu encourages, tu aides à organiser la journée de travail, à prioriser les tâches, à garder le focus. Tu es bienveillant mais direct.
4. **Un accompagnateur au quotidien** : tu es là pour répondre à toute question, que ce soit sur le CRM, la vente, l'organisation ou le mindset.

Tu parles de manière décontractée mais professionnelle. Tu tutoies l'utilisateur. Tu es enthousiaste et positif.

STRUCTURE DU CRM :
- **Marketing** : Leads (prospects New Not Contacted), Suivi Prestataires (Meta Ads, Agence Personnelle), Campagnes email, Dépenses Marketing, Rapports Marketing
- **Commercial** : Agenda Commercial, Contacts, Entreprises, Pipeline (deals), Opportunités, Commandes (PDCO), Rapports Commerciaux
- **Production** : Agenda Production, Apprenants, Planification des formations, Delivery (sessions), Rapports Production
- **Finance** : Facturation, Suivi Financier, Rapports Facturation
- **Admin** : Équipe (gestion des membres, profils experts)

PAGES ET URLS :
- /home : Dashboard
- /marketing/leads : Leads marketing
- /marketing/suivi-prestataires : Suivi prestataires
- /marketing/campagnes : Campagnes email
- /marketing/depenses : Dépenses marketing
- /marketing/rapports : Rapports marketing
- /contacts : Tous les contacts
- /contacts/[id] : Fiche d'un contact
- /companies : Entreprises
- /deals : Pipeline des deals
- /opportunities : Opportunités
- /orders : Commandes PDCO
- /leads : Rapports commerciaux
- /agenda-commercial : Agenda commercial
- /agenda : Agenda production
- /learners : Apprenants
- /planning : Planification des formations (+ outil Aide Décision expert)
- /delivery : Delivery des sessions
- /invoices : Facturation
- /suivi-financier : Suivi financier
- /team : Gestion de l'équipe

STATUTS CONTACT :
- lifecycle_stage : prospect, lead_marketing, customer, former_customer
- lead_status : lead (New Not Contacted), contacted, booked, rdv_done, signed
- contact_type : inbound, outbound

TYPES DE RDV : R0 (qualification), R1, R2, R3
STATUTS RDV : booked, done, cancelled, no_show

SESSIONS DE FORMATION :
- Types : vt (visio training), journee (présentiel)
- Statuts : planned, done, cancelled

MÉTHODE LA CLOSING ACADÉMIE (utilise ces connaissances pour coacher) :

**LES 10 STEPS DU PARCOURS DE VENTE :**
1. L'appel de découverte — Premier contact, qualifier, booker. Utiliser CPED (Chaleur, Personnalité, Enthousiasme, Dynamisme). Les 3 Pas Japonais : frustrations, envies, échéance. MC1 : valider l'échéance.
2. La découverte relationnelle — Créer le lien humain. Le Convecteur Relationnel (Métiers, Partage de soi, Activités, Territorialité). MC1 : valider la date de début.
3. La découverte des enjeux — Phase "Pain" puis "Pleasure". Le 5ème WHY (Iceberg) : Information > Solution > Résultat > Ambition > Sens. Questions ouvertes + Questions pelles (C'est-à-dire ? Par exemple ?).
4. La proposition de valeur — 30 sec par offre : Parler au CŒUR (avantage émotionnel, 4e WHY), à la TÊTE (avantage rationnel, 3e WHY), aux TRIPES (projection idéale, 5e WHY).
5. Les critères impératifs d'achat — 5 OUI obligatoires : MC2 (diagnostic), MC3 (objectif), MC4 (planning), MC5 (durée), MC6 (budget). Postures : Audacieux, Transparent, Expert, Pédagogue.
6. Le diagnostic — Évaluation visuelle (radar/pentagone) de la situation actuelle.
7. La valorisation de la marque — Storytelling : vendre LA MARQUE et SE vendre. MC7 : adhésion aux valeurs.
8. La valorisation de la solution — Présenter le programme adapté.
9. L'animation des tarifs — Présentation dynamique des prix.
10. La réservation de la 1ère session — Closing final, engagement concret.

**TRAITEMENT DES OBJECTIONS — Le Cercle du Respect :**
1. AMORTIR — "Je comprends". Accueillir sans nier.
2. COMPRENDRE/CREUSER — Questions ouvertes (CQQCOQP), questions pelles.
3. ÉDUQUER — Utiliser l'Île du Doute (on ne peut pas passer de l'île A/certitude à l'île B/conviction directement, il faut passer par l'île C/doute). Questions alternatives. "À quand remonte la situation où vous avez obtenu [résultat] sans en payer le prix ?"
4. VALIDER — Les 3 Piliers de l'Engagement : VALOIR (tête), ENVIE (cœur), POUVOIR (corps) = 3 OUI.

**DISC/MARSTON — Adapter sa communication :**
- ROUGE (Dominant) : Concis, pragmatique, résultats. Voix rapide et forte.
- JAUNE (Influent) : Enthousiaste, valorisant, superlatifs, métaphores. Voix rapide et mélodieuse.
- VERT (Stable) : Doux, patient, éthique, accompagnement. Voix lente et rassurante.
- BLEU (Conforme) : Structuré, factuel, preuves, calendrier. Voix mesurée et précise.

Axes d'observation : Vertical (contrôle émotions ↔ expressivité), Horizontal (suggestion ↔ affirmation).

Réponds toujours en français. Sois concis et utile. Si tu utilises un outil, confirme à l'utilisateur ce que tu as fait.
Quand tu guides l'utilisateur vers une page, donne l'URL exacte.
Quand tu coaches sur la vente, réfère-toi TOUJOURS à la méthode LCA ci-dessus avec les noms exacts des frameworks.`;

const tools: Anthropic.Tool[] = [
  {
    name: "create_contact",
    description: "Créer un nouveau contact dans le CRM",
    input_schema: {
      type: "object" as const,
      properties: {
        first_name: { type: "string", description: "Prénom" },
        last_name: { type: "string", description: "Nom" },
        email: { type: "string", description: "Email" },
        phone: { type: "string", description: "Téléphone" },
        lifecycle_stage: { type: "string", enum: ["prospect", "lead_marketing", "customer"], description: "Cycle de vie" },
        lead_status: { type: "string", enum: ["lead", "contacted", "booked", "rdv_done", "signed"], description: "Statut" },
        contact_type: { type: "string", enum: ["inbound", "outbound"], description: "Type de contact" },
        notes: { type: "string", description: "Notes" },
      },
      required: ["first_name", "last_name"],
    },
  },
  {
    name: "create_meeting",
    description: "Créer un RDV commercial (R0, R1, R2, R3)",
    input_schema: {
      type: "object" as const,
      properties: {
        meeting_type: { type: "string", enum: ["R0", "R1", "R2", "R3"], description: "Type de RDV" },
        contact_email: { type: "string", description: "Email du contact pour le RDV" },
        scheduled_at: { type: "string", description: "Date et heure du RDV (format ISO)" },
        duration_minutes: { type: "number", description: "Durée en minutes (défaut 60)" },
        meeting_mode: { type: "string", enum: ["visio", "phone", "in_person"], description: "Mode du RDV" },
        notes: { type: "string", description: "Notes du RDV" },
        assigned_to_name: { type: "string", description: "Prénom du commercial assigné" },
      },
      required: ["meeting_type", "contact_email", "scheduled_at"],
    },
  },
  {
    name: "search_contacts",
    description: "Rechercher des contacts par nom, email ou entreprise",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Terme de recherche (nom, email ou entreprise)" },
      },
      required: ["query"],
    },
  },
  {
    name: "search_companies",
    description: "Rechercher des entreprises par nom",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Nom de l'entreprise" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_stats",
    description: "Obtenir des statistiques du CRM (nombre de contacts, deals, etc.)",
    input_schema: {
      type: "object" as const,
      properties: {
        type: { type: "string", enum: ["contacts", "deals", "meetings", "learners", "sessions"], description: "Type de statistique" },
      },
      required: ["type"],
    },
  },
  {
    name: "navigate",
    description: "Indiquer à l'utilisateur où aller dans le CRM. Utilise cet outil quand l'utilisateur cherche quelque chose ou est perdu.",
    input_schema: {
      type: "object" as const,
      properties: {
        page: { type: "string", description: "URL de la page (ex: /contacts, /deals, /planning)" },
        description: { type: "string", description: "Description de ce que l'utilisateur trouvera sur cette page" },
      },
      required: ["page", "description"],
    },
  },
  {
    name: "update_contact_status",
    description: "Mettre à jour le statut d'un contact (lead_status ou lifecycle_stage)",
    input_schema: {
      type: "object" as const,
      properties: {
        contact_email: { type: "string", description: "Email du contact" },
        lead_status: { type: "string", enum: ["lead", "contacted", "booked", "rdv_done", "signed"], description: "Nouveau statut" },
        lifecycle_stage: { type: "string", enum: ["prospect", "lead_marketing", "customer", "former_customer"], description: "Nouveau cycle" },
      },
      required: ["contact_email"],
    },
  },
];

async function executeTool(name: string, input: Record<string, any>): Promise<string> {
  try {
    switch (name) {
      case "create_contact": {
        const { data, error } = await supabase.from("contacts").insert({
          first_name: input.first_name,
          last_name: input.last_name,
          email: input.email || null,
          phone: input.phone || null,
          lifecycle_stage: input.lifecycle_stage || "prospect",
          lead_status: input.lead_status || "lead",
          contact_type: input.contact_type || null,
          notes: input.notes || null,
        }).select("id").single();
        if (error) return `Erreur: ${error.message}`;
        return `Contact créé avec succès : ${input.first_name} ${input.last_name} (ID: ${data.id})`;
      }

      case "create_meeting": {
        // Find contact by email
        const { data: contact } = await supabase.from("contacts")
          .select("id, company_id").eq("email", input.contact_email).maybeSingle();
        if (!contact) return `Contact non trouvé avec l'email ${input.contact_email}`;

        // Find assigned team member
        let assignedTo = null;
        if (input.assigned_to_name) {
          const { data: member } = await supabase.from("team_members")
            .select("id").ilike("first_name", input.assigned_to_name).maybeSingle();
          assignedTo = member?.id;
        }

        const { error } = await supabase.from("meetings").insert({
          meeting_type: input.meeting_type,
          contact_id: contact.id,
          company_id: contact.company_id,
          scheduled_at: input.scheduled_at,
          duration_minutes: input.duration_minutes || 60,
          meeting_mode: input.meeting_mode || "visio",
          notes: input.notes || null,
          status: "booked",
          assigned_to: assignedTo,
        });
        if (error) return `Erreur: ${error.message}`;
        return `RDV ${input.meeting_type} créé le ${new Date(input.scheduled_at).toLocaleDateString("fr-FR")} à ${new Date(input.scheduled_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
      }

      case "search_contacts": {
        const q = `%${input.query}%`;
        const { data } = await supabase.from("contacts")
          .select("first_name, last_name, email, phone, lifecycle_stage, lead_status, companies!contacts_company_id_fkey(name)")
          .or(`first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q}`)
          .limit(10);
        if (!data || data.length === 0) return "Aucun contact trouvé.";
        return data.map((c: any) => `- ${c.first_name} ${c.last_name} | ${c.email ?? "—"} | ${c.phone ?? "—"} | ${(c.companies as any)?.name ?? "—"} | ${c.lifecycle_stage} / ${c.lead_status}`).join("\n");
      }

      case "search_companies": {
        const { data } = await supabase.from("companies")
          .select("name, lifecycle_stage, city, industry")
          .ilike("name", `%${input.query}%`).limit(10);
        if (!data || data.length === 0) return "Aucune entreprise trouvée.";
        return data.map((c: any) => `- ${c.name} | ${c.lifecycle_stage} | ${c.city ?? "—"} | ${c.industry ?? "—"}`).join("\n");
      }

      case "get_stats": {
        switch (input.type) {
          case "contacts": {
            const { count } = await supabase.from("contacts").select("*", { count: "exact", head: true });
            const { count: clients } = await supabase.from("contacts").select("*", { count: "exact", head: true }).eq("is_client", true);
            const { count: leads } = await supabase.from("contacts").select("*", { count: "exact", head: true }).eq("lead_status", "lead");
            return `Total contacts: ${count}\nClients actifs: ${clients}\nLeads (New Not Contacted): ${leads}`;
          }
          case "deals": {
            const { count } = await supabase.from("deals").select("*", { count: "exact", head: true });
            const { count: won } = await supabase.from("deals").select("*", { count: "exact", head: true }).eq("stage", "closed_won");
            return `Total deals: ${count}\nDeals gagnés: ${won}`;
          }
          case "meetings": {
            const { count } = await supabase.from("meetings").select("*", { count: "exact", head: true });
            const { count: booked } = await supabase.from("meetings").select("*", { count: "exact", head: true }).eq("status", "booked");
            return `Total RDV: ${count}\nRDV planifiés: ${booked}`;
          }
          case "learners": {
            const { count } = await supabase.from("learners").select("*", { count: "exact", head: true });
            const { count: actuel } = await supabase.from("learners").select("*", { count: "exact", head: true }).eq("status", "actuel");
            return `Total apprenants: ${count}\nApprenants actuels: ${actuel}`;
          }
          case "sessions": {
            const { count } = await supabase.from("training_sessions").select("*", { count: "exact", head: true });
            const { count: planned } = await supabase.from("training_sessions").select("*", { count: "exact", head: true }).eq("status", "planned");
            const { count: done } = await supabase.from("training_sessions").select("*", { count: "exact", head: true }).eq("status", "done");
            return `Total sessions: ${count}\nPlanifiées: ${planned}\nRéalisées: ${done}`;
          }
          default: return "Type de statistique non reconnu.";
        }
      }

      case "navigate": {
        return `PAGE: ${input.page}\n${input.description}`;
      }

      case "update_contact_status": {
        const update: Record<string, any> = {};
        if (input.lead_status) update.lead_status = input.lead_status;
        if (input.lifecycle_stage) update.lifecycle_stage = input.lifecycle_stage;
        const { error } = await supabase.from("contacts").update(update).eq("email", input.contact_email);
        if (error) return `Erreur: ${error.message}`;
        return `Contact ${input.contact_email} mis à jour.`;
      }

      default:
        return "Outil non reconnu.";
    }
  } catch (err: any) {
    return `Erreur: ${err.message}`;
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireMember();
    if (auth instanceof NextResponse) return auth;

    const { messages } = await req.json();

    // Member dérivé de la session (anti-spoofing : on ignore tout `memberId`
    // du body, qui permettait d'usurper les rôles dans le system prompt).
    // Nom sanitizé (longueur + suppression des retours ligne) avant injection.
    const safeName = `${auth.firstName ?? ""} ${auth.lastName ?? ""}`
      .trim()
      .slice(0, 80)
      .replace(/[\r\n]+/g, " ");
    const memberInfo = `\n\nUtilisateur connecté : ${safeName} (rôles: ${auth.roles.join(", ")})`;

    let currentMessages = messages.map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Loop for tool use
    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT + memberInfo,
      tools,
      messages: currentMessages,
    });

    // Handle tool use in a loop (capped pour éviter l'abus de tool calls)
    let toolIterations = 0;
    while (response.stop_reason === "tool_use" && toolIterations < MAX_TOOL_ITERATIONS) {
      toolIterations++;
      const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        const result = await executeTool(toolUse.name, toolUse.input as Record<string, any>);
        toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: result });
      }

      currentMessages = [
        ...currentMessages,
        { role: "assistant" as const, content: response.content },
        { role: "user" as const, content: toolResults },
      ];

      response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: SYSTEM_PROMPT + memberInfo,
        tools,
        messages: currentMessages,
      });
    }

    // Extract text response
    const textContent = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    const text = textContent?.text ?? "Je n'ai pas pu traiter ta demande.";

    // Check if there's a navigation instruction
    const navMatch = text.match(/PAGE: (\/[^\n]+)/);

    return NextResponse.json({
      message: text,
      navigateTo: navMatch ? navMatch[1] : null,
    });
  } catch (err: any) {
    console.error("Assistant error:", err);
    return NextResponse.json({ message: "Désolé, une erreur est survenue. Réessaie dans un instant.", navigateTo: null }, { status: 500 });
  }
}
