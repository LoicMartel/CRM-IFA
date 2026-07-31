import { Header } from "@/components/layout/header";
import { RessourcesCommercialesView } from "@/components/commercial/ressources-commerciales-view";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Ressources" };

export default async function RessourcesCommercialesPage() {
  const supabase = await createClient();

  const [{ data: deals }, { data: companies }, { data: contacts }, { data: quotations }, { data: resourceLinks }] = await Promise.all([
    supabase.from("deals").select("id, name, company_id, amount, companies(name)").order("created_at", { ascending: false }),
    supabase.from("companies").select("id, name").order("name"),
    supabase.from("contacts").select("id, first_name, last_name, company_id").order("last_name"),
    supabase.from("quotations").select("*").order("created_at", { ascending: false }),
    supabase.from("resource_links").select("*").eq("category", "commercial").order("display_order"),
  ]);

  return (
    <>
      <Header title="Ressources Commerciales" />
      <div className="p-6">
        <RessourcesCommercialesView
          deals={(deals ?? []) as any}
          companies={(companies ?? []) as any}
          contacts={(contacts ?? []) as any}
          quotations={(quotations ?? []) as any}
          resourceLinks={(resourceLinks ?? []) as any}
        />
      </div>
    </>
  );
}
