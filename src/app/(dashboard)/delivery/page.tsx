import { Header } from "@/components/layout/header";
import { DeliveryView } from "@/components/production/delivery-view";
import { createClient } from "@/lib/supabase/server";

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

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

  const items = (sessions ?? []) as any[];

  const totalHours = items.reduce((s: number, sess: any) => s + (Number(sess.hours_delivered) || 0), 0);
  const billableSessions = items.filter((s: any) => s.is_billable !== false);
  const nonBillableSessions = items.filter((s: any) => s.is_billable === false);
  const totalBillableHours = billableSessions.reduce((s: number, sess: any) => s + (Number(sess.hours_delivered) || 0), 0);
  const totalBillableAmount = items.reduce((s: number, sess: any) => s + (Number(sess.billable_amount) || 0), 0);
  const totalNonBillableAmount = items.reduce((s: number, sess: any) => s + (Number(sess.non_billable_amount) || 0), 0);

  return (
    <>
      <Header title="Delivery (Sessions réalisées)" />
      <div className="p-6 space-y-6">
        <div className="grid gap-3 md:grid-cols-5">
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Sessions réalisées</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a" }}>{items.length}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Heures délivrées</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a6b9c" }}>{totalHours.toFixed(1)}h</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Heures facturables</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#27ae60" }}>{totalBillableHours.toFixed(0)}h</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Facturable sur Delivery</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#27ae60" }}>{fmt(totalBillableAmount)}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Non facturable</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#FF6B35" }}>{fmt(totalNonBillableAmount)}</div>
          </div>
        </div>

        <DeliveryView sessions={items} />
      </div>
    </>
  );
}
