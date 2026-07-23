import { createClient } from "@/lib/supabase/client";
import { normalizePhone, isBlacklistedPhone } from "./normalize-phone";

export interface DuplicateResult {
  isDuplicate: boolean;
  message: string;
  existingId?: string;
  existingName?: string;
}

/**
 * Check if a learner with the same email already exists
 */
export async function checkLearnerDuplicate(email: string): Promise<DuplicateResult> {
  if (!email) return { isDuplicate: false, message: "" };
  const supabase = createClient();
  const { data } = await supabase
    .from("learners")
    .select("id, first_name, last_name, email")
    .ilike("email", email.trim())
    .limit(1)
    .maybeSingle();

  if (data) {
    return {
      isDuplicate: true,
      message: `Un apprenant avec cet email existe déjà : ${data.first_name} ${data.last_name} (${data.email})`,
      existingId: data.id,
      existingName: `${data.first_name} ${data.last_name}`,
    };
  }
  return { isDuplicate: false, message: "" };
}

/**
 * Check if a contact with the same email or phone already exists
 */
export async function checkContactDuplicate(email: string, phone?: string): Promise<DuplicateResult> {
  const supabase = createClient();

  // Rule 1: Email match
  if (email) {
    const { data } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, email")
      .ilike("email", email.trim())
      .limit(1)
      .maybeSingle();
    if (data) {
      return {
        isDuplicate: true,
        message: `Un contact avec cet email existe déjà : ${data.first_name} ${data.last_name} (${data.email})`,
        existingId: data.id,
        existingName: `${data.first_name} ${data.last_name}`,
      };
    }
  }

  // Rule 2: Phone match (normalized)
  const normalized = normalizePhone(phone);
  if (normalized && !isBlacklistedPhone(normalized)) {
    const { data } = await supabase.rpc("find_contact_by_normalized_phone", {
      p_phone: normalized,
    });
    if (data && data.length > 0) {
      const c = data[0];
      return {
        isDuplicate: true,
        message: `Un contact avec ce téléphone existe déjà : ${c.first_name ?? ""} ${c.last_name ?? ""} (${c.phone})`.trim(),
        existingId: c.id,
        existingName: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
      };
    }
  }

  return { isDuplicate: false, message: "" };
}

/**
 * Check if a company with a similar name already exists (normalized: dashes, spaces, case)
 */
export async function checkCompanyDuplicate(name: string): Promise<DuplicateResult> {
  if (!name) return { isDuplicate: false, message: "" };
  const supabase = createClient();

  // Try normalized name match via DB function
  const normalized = name.toLowerCase().replace(/[-_.]/g, " ").replace(/\s+/g, " ").trim();
  if (normalized && normalized !== "www" && normalized.length > 1) {
    const { data } = await supabase.rpc("find_company_by_normalized_name", {
      p_name: normalized,
    });
    if (data && data.length > 0) {
      return {
        isDuplicate: true,
        message: `Une entreprise avec ce nom existe déjà : ${data[0].name}`,
        existingId: data[0].id,
        existingName: data[0].name,
      };
    }
  }

  return { isDuplicate: false, message: "" };
}

/**
 * Check if a training session on the same date + same plan already exists
 */
export async function checkSessionDuplicate(
  servicePlanId: string,
  sessionDate: string
): Promise<DuplicateResult> {
  if (!servicePlanId || !sessionDate) return { isDuplicate: false, message: "" };
  const supabase = createClient();
  const { data } = await supabase
    .from("training_sessions")
    .select("id, session_date, service_plan_id")
    .eq("service_plan_id", servicePlanId)
    .eq("session_date", sessionDate)
    .limit(1)
    .maybeSingle();

  if (data) {
    return {
      isDuplicate: true,
      message: `Une session existe déjà pour ce plan à cette date (${sessionDate})`,
      existingId: data.id,
    };
  }
  return { isDuplicate: false, message: "" };
}
