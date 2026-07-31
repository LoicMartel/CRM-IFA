import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { ResourceLinksPage } from "@/components/production/resource-links-page";

export const metadata = { title: "Ressources Pédagogiques" };

export default async function RessourcesPage() {
  const supabase = await createClient();
  const { data: resourceLinks } = await supabase
    .from("resource_links")
    .select("*")
    .eq("category", "production")
    .order("display_order");

  return (
    <>
      <Header title="Ressources Pédagogiques" />
      <div className="p-6">
        <ResourceLinksPage resourceLinks={(resourceLinks ?? []) as any} />
      </div>
    </>
  );
}
