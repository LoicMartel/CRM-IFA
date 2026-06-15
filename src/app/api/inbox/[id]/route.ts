import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: conversation } = await sb.from("conversations")
    .select("*, contacts(id,first_name,last_name,email,phone,source_id)").eq("id", id).maybeSingle();
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Libellé lisible de la source du lead (Meta ads tunnel book/commercial…) pour l'afficher dans le thread.
  let source_label: string | null = null;
  const contact = Array.isArray(conversation.contacts) ? conversation.contacts[0] : conversation.contacts;
  if (contact?.source_id) {
    const { data: src } = await sb.from("lead_sources").select("name").eq("id", contact.source_id).maybeSingle();
    source_label = src?.name ?? null;
  }

  // Détails contact pour le panneau enrichi de l'inbox (entreprise, owner, statut, ancienneté, deals liés).
  // Best-effort : un champ manquant ne casse pas le thread (les colonnes manquantes restent simplement vides).
  let contact_detail: {
    created_at: string | null;
    lifecycle_stage: string | null;
    lead_status: string | null;
    company_name: string | null;
    owner_name: string | null;
    deals: Array<{ id: string; name: string | null; stage: string | null; amount: number | null }>;
  } | null = null;
  if (contact?.id) {
    const [{ data: full }, { data: deals }] = await Promise.all([
      sb.from("contacts")
        .select("created_at, lifecycle_stage, lead_status, companies!contacts_company_id_fkey(name), team_members!contacts_owner_id_fkey(first_name, last_name)")
        .eq("id", contact.id).maybeSingle(),
      sb.from("deals").select("id, name, stage, amount").eq("contact_id", contact.id).order("created_at", { ascending: false }),
    ]);
    const company = full ? (Array.isArray(full.companies) ? full.companies[0] : full.companies) : null;
    const owner = full ? (Array.isArray(full.team_members) ? full.team_members[0] : full.team_members) : null;
    contact_detail = {
      created_at: (full?.created_at as string | null) ?? null,
      lifecycle_stage: (full?.lifecycle_stage as string | null) ?? null,
      lead_status: (full?.lead_status as string | null) ?? null,
      company_name: company?.name ?? null,
      owner_name: owner ? `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim() || null : null,
      deals: deals ?? [],
    };
  }

  const { data: messages } = await sb.from("messages").select("*").eq("conversation_id", id).order("created_at", { ascending: true });
  await sb.from("conversations").update({ unread: false }).eq("id", id);
  return NextResponse.json({ conversation, messages: messages ?? [], source_label, contact_detail });
}
