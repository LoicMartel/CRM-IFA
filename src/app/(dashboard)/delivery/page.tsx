import { Header } from "@/components/layout/header";
import { DeliveryView } from "@/components/production/delivery-view";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Delivery" };

export default async function DeliveryPage() {
  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from("sessions")
    .select(`
      *,
      session_themes(name),
      team_members(id, first_name, last_name),
      companies(id, name)
    `)
    .not("company_id", "is", null)
    .order("session_date", { ascending: false });

  return (
    <>
      <Header title="Delivery (Sessions réalisées)" />
      <div className="p-6 space-y-6">
        <DeliveryView sessions={(sessions ?? []) as any} />
      </div>
    </>
  );
}
