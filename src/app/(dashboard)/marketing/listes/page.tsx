import { Header } from "@/components/layout/header";
import { ContactListsView } from "@/components/marketing/contact-lists-view";
import { createClient } from "@/lib/supabase/server";

export default async function ListesPage() {
  const supabase = await createClient();

  const [
    { data: lists },
    { data: contacts },
  ] = await Promise.all([
    supabase.from("contact_lists").select("*, contact_list_members(contact_id)").order("created_at", { ascending: false }),
    supabase.from("contacts").select("id, first_name, last_name, email, companies!contacts_company_id_fkey(name)").not("email", "is", null).order("last_name"),
  ]);

  return (
    <>
      <Header title="Listes de contacts" />
      <div className="p-6 space-y-6">
        <ContactListsView lists={lists ?? []} contacts={contacts ?? []} />
      </div>
    </>
  );
}
