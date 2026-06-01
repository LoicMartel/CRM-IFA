import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Assigne (idempotent) un numéro de devis CRM au deal s'il n'en a pas encore.
 * Format DEV-{année}-{NNN}. Increment atomique via la fonction Postgres next_quote_number.
 * Retourne le numéro (existant ou nouvellement créé).
 */
export async function assignQuoteNumber(
  serviceClient: SupabaseClient,
  dealId: string,
): Promise<string> {
  const { data: deal } = await serviceClient
    .from("deals").select("quote_number").eq("id", dealId).maybeSingle();
  if (deal?.quote_number) return deal.quote_number as string;

  const year = Number(new Date().toISOString().slice(0, 4));
  const { data: seq, error } = await serviceClient.rpc("next_quote_number", { p_year: year });
  if (error) throw new Error(`Numérotation devis échouée : ${error.message}`);
  const num = `DEV-${year}-${String(seq).padStart(3, "0")}`;
  await serviceClient.from("deals").update({ quote_number: num }).eq("id", dealId);
  return num;
}
