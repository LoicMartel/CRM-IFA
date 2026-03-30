import { createClient } from "@/lib/supabase/client";

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
 * Check if a contact with the same email already exists
 */
export async function checkContactDuplicate(email: string): Promise<DuplicateResult> {
  if (!email) return { isDuplicate: false, message: "" };
  const supabase = createClient();
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
  return { isDuplicate: false, message: "" };
}

/**
 * Check if a company with a similar name already exists
 */
export async function checkCompanyDuplicate(name: string): Promise<DuplicateResult> {
  if (!name) return { isDuplicate: false, message: "" };
  const supabase = createClient();
  const { data } = await supabase
    .from("companies")
    .select("id, name")
    .ilike("name", name.trim())
    .limit(1)
    .maybeSingle();

  if (data) {
    return {
      isDuplicate: true,
      message: `Une entreprise avec ce nom existe déjà : ${data.name}`,
      existingId: data.id,
      existingName: data.name,
    };
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
