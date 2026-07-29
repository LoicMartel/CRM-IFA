import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { getFiscalMode } from "@/lib/get-fiscal-mode";
import { OrdersFromDeals } from "@/components/commercial/orders-from-deals";

export const metadata = { title: "Commandes (PDCO)" };

export default async function OrdersPage() {
  const [supabase, fiscalMode] = await Promise.all([createClient(), getFiscalMode()]);

  const [
    { data: deals },
    { data: teamMembers },
    { data: sources },
    { data: invoices },
  ] = await Promise.all([
    supabase.from("deals").select("*, contacts(id, first_name, last_name), companies(id, name), team_members(first_name, last_name), lead_sources(name)")
      .eq("stage", "closed_won")
      .order("close_date", { ascending: false }),
    supabase.from("team_members").select("id, first_name, last_name, roles").eq("is_active", true),
    supabase.from("lead_sources").select("id, name"),
    supabase.from("invoices").select("id, deal_id, notes").not("notes", "is", null),
  ]);

  return (
    <>
      <Header title="Prises de Commandes (PDCO)" />
      <div className="p-6 space-y-6">
        <OrdersFromDeals
          deals={deals ?? []}
          teamMembers={(teamMembers ?? []).filter((m: any) => ((m.roles as string[]) ?? []).includes("Account Manager"))}
          sources={sources ?? []}
          invoiceNotes={(invoices ?? []) as any}
          fiscalMode={fiscalMode}
        />
      </div>
    </>
  );
}
