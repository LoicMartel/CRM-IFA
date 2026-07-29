import { createClient } from "@/lib/supabase/server";
import type { FiscalMode } from "./fiscal-year";

/**
 * Load the fiscal year mode from crm_settings.
 * Returns "jan-dec" as default if not set.
 */
export async function getFiscalMode(): Promise<FiscalMode> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("crm_settings")
    .select("value")
    .eq("key", "fiscal_year_mode")
    .maybeSingle();
  return (data?.value as FiscalMode) ?? "jan-dec";
}
