import { createClient } from "@/lib/supabase/server";
import type { FiscalMode } from "@/lib/fiscal-year";

/**
 * Loads the fiscal year mode from crm_settings (server-side only).
 * Falls back to "sep-aug" if the setting is missing or the query fails.
 */
export async function getFiscalMode(): Promise<FiscalMode> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("crm_settings")
    .select("value")
    .eq("key", "fiscal_year_mode")
    .maybeSingle();

  if (data?.value === "jan-dec" || data?.value === "sep-aug") {
    return data.value;
  }
  return "sep-aug";
}
