import { Header } from "@/components/layout/header";
import { DeliveryView } from "@/components/production/delivery-view";
import { createClient } from "@/lib/supabase/server";

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

export default async function DeliveryPage() {
  const supabase = await createClient();

  const [{ data: sessions }, { data: trainingSessions }] = await Promise.all([
    supabase
      .from("sessions")
      .select(`
        *,
        session_themes(name),
        team_members(id, first_name, last_name),
        companies(id, name)
      `)
      .not("company_id", "is", null)
      .order("session_date", { ascending: false }),
    supabase
      .from("training_sessions")
      .select(`
        *,
        service_plans(id, company_id, hourly_rate, companies(id, name))
      `)
      .in("status", ["done", "no_show"]),
  ]);

  const items = (sessions ?? []) as any[];

  // Also compute from training_sessions for KPIs (source of truth for planned sessions)
  const tsItems = (trainingSessions ?? []) as any[];
  const tsTotalHours = tsItems.reduce((s: number, ts: any) => s + (Number(ts.duration_hours) || 0), 0);
  const tsBillableHours = tsItems.filter((s: any) => s.is_billable !== false).reduce((s: number, ts: any) => s + (Number(ts.duration_hours) || 0), 0);
  const tsBillableAmount = tsItems.filter((s: any) => s.is_billable !== false).reduce((s: number, ts: any) => {
    const rate = Number(ts.service_plans?.hourly_rate) || 0;
    return s + (Number(ts.duration_hours) || 0) * rate;
  }, 0);
  const tsNonBillableAmount = tsItems.filter((s: any) => s.is_billable === false).reduce((s: number, ts: any) => {
    const rate = Number(ts.service_plans?.hourly_rate) || 0;
    return s + (Number(ts.duration_hours) || 0) * rate;
  }, 0);

  // Delivery sessions KPIs
  const deliveryTotalHours = items.reduce((s: number, sess: any) => s + (Number(sess.hours_delivered) || 0), 0);
  const deliveryBillableHours = items.filter((s: any) => s.is_billable !== false).reduce((s: number, sess: any) => s + (Number(sess.hours_delivered) || 0), 0);
  const deliveryBillableAmount = items.reduce((s: number, sess: any) => s + (Number(sess.billable_amount) || 0), 0);
  const deliveryNonBillableAmount = items.reduce((s: number, sess: any) => s + (Number(sess.non_billable_amount) || 0), 0);

  // Use the max of both sources to get the most up-to-date value
  const totalHours = Math.max(deliveryTotalHours, tsTotalHours);
  const totalBillableHours = Math.max(deliveryBillableHours, tsBillableHours);
  const totalBillableAmount = Math.max(deliveryBillableAmount, tsBillableAmount);
  const totalNonBillableAmount = Math.max(deliveryNonBillableAmount, tsNonBillableAmount);

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
