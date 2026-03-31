import { Header } from "@/components/layout/header";
import { CampaignsListView } from "@/components/marketing/campaigns-list-view";
import { createClient } from "@/lib/supabase/server";

export default async function CampagnesPage() {
  const supabase = await createClient();

  const [
    { data: campaigns },
    { data: contactLists },
    { data: contacts },
  ] = await Promise.all([
    supabase.from("marketing_campaigns").select("*, contact_lists(name)").order("created_at", { ascending: false }),
    supabase.from("contact_lists").select("id, name").order("name"),
    supabase.from("contacts").select("id, first_name, last_name, email").not("email", "is", null).order("last_name"),
  ]);

  // Get recipient stats per campaign
  const campaignIds = (campaigns ?? []).map((c) => c.id);
  let recipientStats: Record<string, { total: number; delivered: number; opened: number; clicked: number; bounced: number }> = {};

  if (campaignIds.length > 0) {
    const { data: recipients } = await supabase
      .from("campaign_recipients")
      .select("campaign_id, status")
      .in("campaign_id", campaignIds);

    for (const r of recipients ?? []) {
      if (!recipientStats[r.campaign_id]) {
        recipientStats[r.campaign_id] = { total: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };
      }
      recipientStats[r.campaign_id].total++;
      if (["delivered", "opened", "clicked"].includes(r.status)) recipientStats[r.campaign_id].delivered++;
      if (["opened", "clicked"].includes(r.status)) recipientStats[r.campaign_id].opened++;
      if (r.status === "clicked") recipientStats[r.campaign_id].clicked++;
      if (["bounced", "complained"].includes(r.status)) recipientStats[r.campaign_id].bounced++;
    }
  }

  return (
    <>
      <Header title="Campagnes Marketing" />
      <div className="p-6 space-y-6">
        <CampaignsListView
          campaigns={campaigns ?? []}
          contactLists={contactLists ?? []}
          contacts={contacts ?? []}
          recipientStats={recipientStats}
        />
      </div>
    </>
  );
}
