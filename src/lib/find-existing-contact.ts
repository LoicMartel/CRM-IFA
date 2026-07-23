import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhone, isBlacklistedPhone } from "./normalize-phone";

interface ContactMatch {
  id: string;
  email: string | null;
  phone: string | null;
  lifecycle_stage: string | null;
}

/**
 * Find an existing contact by email (exact, case-insensitive) then by normalized phone.
 */
export async function findExistingContact(
  supabase: SupabaseClient,
  { email, phone }: { email?: string | null; phone?: string | null },
): Promise<ContactMatch | null> {
  // Rule 1: Email match
  if (email) {
    const { data } = await supabase
      .from("contacts")
      .select("id, email, phone, lifecycle_stage")
      .ilike("email", email.trim())
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  // Rule 2: Normalized phone match (skip blacklisted / placeholder numbers)
  const normalized = normalizePhone(phone);
  if (normalized && !isBlacklistedPhone(normalized)) {
    const { data } = await supabase.rpc("find_contact_by_normalized_phone", {
      p_phone: normalized,
    });
    if (data && data.length > 0) {
      const c = data[0];
      return { id: c.id, email: c.email, phone: c.phone, lifecycle_stage: c.lifecycle_stage };
    }
  }

  return null;
}

/**
 * Detect changes in email/phone between existing contact and new submission,
 * update the contact with the latest values, and log an activity.
 *
 * Returns the list of changes applied (empty if nothing changed).
 */
export async function applyContactInfoChanges(
  supabase: SupabaseClient,
  existing: ContactMatch,
  incoming: { email?: string | null; phone?: string | null },
): Promise<{ field: string; oldValue: string | null; newValue: string | null }[]> {
  const changes: { field: string; oldValue: string | null; newValue: string | null }[] = [];

  if (incoming.email && existing.email?.toLowerCase() !== incoming.email.toLowerCase()) {
    changes.push({ field: "Email", oldValue: existing.email, newValue: incoming.email });
  }

  const existingNorm = normalizePhone(existing.phone);
  const incomingNorm = normalizePhone(incoming.phone);
  if (incoming.phone && incomingNorm && existingNorm !== incomingNorm) {
    changes.push({ field: "Téléphone", oldValue: existing.phone, newValue: incoming.phone });
  }

  if (changes.length === 0) return changes;

  // Update contact with latest values
  const update: Record<string, string> = {};
  for (const c of changes) {
    if (c.field === "Email" && c.newValue) update.email = c.newValue;
    if (c.field === "Téléphone" && c.newValue) update.phone = c.newValue;
  }
  await supabase.from("contacts").update(update).eq("id", existing.id);

  // Log activity for traceability
  const lines = changes.map(
    (c) => `${c.field} : "${c.oldValue || "—"}" → "${c.newValue}"`,
  );
  await supabase.from("activities").insert({
    type: "note",
    title: "Mise à jour automatique des coordonnées",
    description: lines.join("\n"),
    contact_id: existing.id,
    is_completed: true,
    completed_at: new Date().toISOString(),
  });

  return changes;
}

/**
 * Find an existing company by website then by normalized name.
 */
export async function findExistingCompany(
  supabase: SupabaseClient,
  { name, website }: { name: string; website?: string | null },
): Promise<{ id: string; name: string } | null> {
  // Rule 1: Website match
  if (website) {
    const { data } = await supabase
      .from("companies")
      .select("id, name")
      .ilike("website", `%${website}%`)
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  // Rule 2: Normalized name match (ignore garbage like "www")
  const normalized = normalizeCompanyName(name);
  if (normalized && normalized !== "www" && normalized.length > 1) {
    const { data } = await supabase.rpc("find_company_by_normalized_name", {
      p_name: normalized,
    });
    if (data && data.length > 0) {
      return { id: data[0].id, name: data[0].name };
    }
  }

  return null;
}

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[-_.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
