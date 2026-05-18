import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompaniesTable } from "@/components/commercial/companies-table";
import { ContactsTable } from "@/components/commercial/contacts-table";
import { createClient } from "@/lib/supabase/server";
import { Building2, Users, UserCheck } from "lucide-react";

export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  const supabase = await createClient();

  const { data: companies } = await supabase
    .from("companies")
    .select("*, company_types(name), contacts!contacts_company_id_fkey(count), deals(count), signed_deals:deals!deals_company_id_fkey(amount, stage, close_date)")
    .order("name");

  const { data: contacts } = await supabase
    .from("contacts")
    .select("*, companies!contacts_company_id_fkey(name)")
    .order("last_name");

  const { data: companyTypes } = await supabase
    .from("company_types")
    .select("id, name")
    .order("name");

  const companiesList = companies ?? [];
  const contactsList = contacts ?? [];
  const clientsCount = contactsList.filter((c: Record<string, unknown>) => c.is_client).length;

  return (
    <>
      <Header title="Clients" />
      <div className="p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Entreprises</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{companiesList.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Contacts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{contactsList.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Clients actifs</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" style={{ color: "#2e7d32" }}>{clientsCount}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="companies">
          <TabsList>
            <TabsTrigger value="companies">Entreprises ({companiesList.length})</TabsTrigger>
            <TabsTrigger value="contacts">Contacts ({contactsList.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="companies" className="space-y-4 mt-4">
            <CompaniesTable
              companies={companiesList}
              companyTypes={companyTypes ?? []}
            />
          </TabsContent>
          <TabsContent value="contacts" className="space-y-4 mt-4">
            <ContactsTable
              contacts={contactsList}
              companies={companiesList}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
