import { Header } from "@/components/layout/header";
import { CampaignDetailView } from "@/components/marketing/campaign-detail-view";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export const metadata = { title: "Campagne" };

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("marketing_campaigns")
    .select("*, contact_lists(name)")
    .eq("id", id)
    .single();

  if (!campaign) return notFound();

  const { data: recipients } = await supabase
    .from("campaign_recipients")
    .select("*, contacts(first_name, last_name)")
    .eq("campaign_id", id)
    .order("status");

  return (
    <>
      <Header title={campaign.name} />
      <div className="p-6 space-y-6">
        <CampaignDetailView campaign={campaign} recipients={recipients ?? []} />
      </div>
    </>
  );
}
