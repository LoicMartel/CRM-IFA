import { Header } from "@/components/layout/header";
import { RessourcesCommercialesView } from "@/components/commercial/ressources-commerciales-view";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Ressources" };

export default async function RessourcesCommercialesPage() {
  const supabase = await createClient();

  const { data: deals } = await supabase
    .from("deals")
    .select("id, name, company_id, amount, companies(name)")
    .order("created_at", { ascending: false });

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name")
    .order("name");

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, company_id")
    .order("last_name");

  const { data: quotations } = await supabase
    .from("quotations")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <>
      <Header title="Ressources Commerciales" />
      <div className="p-6">
        <RessourcesCommercialesView
          deals={(deals ?? []) as any}
          companies={(companies ?? []) as any}
          contacts={(contacts ?? []) as any}
          quotations={(quotations ?? []) as any}
        />
      </div>
    </>
  );
}
