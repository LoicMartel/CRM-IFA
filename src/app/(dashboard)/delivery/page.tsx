import { Header } from "@/components/layout/header";
import { DeliveryView } from "@/components/production/delivery-view";
import { createClient } from "@/lib/supabase/server";

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

export default async function DeliveryPage() {
  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from("training_sessions")
    .select(`
      *,
      training_session_learners(learner_id, learners(id, first_name, last_name)),
      service_plans(
        id, company_id, hourly_rate, format, mode, deal_id,
        companies(id, name),
        training_programs(name),
        training_types(name)
      )
    `)
    .order("session_date", { ascending: false });

  const items = (sessions ?? []) as any[];

  // Only count done sessions for KPIs
  const doneSessions = items.filter(s => s.status === "done");
  const totalHours = doneSessions.reduce((s: number, sess: any) => s + (Number(sess.duration_hours) || 0), 0);
  const billableSessions = doneSessions.filter((s: any) => s.is_billable !== false);
  const nonBillableSessions = doneSessions.filter((s: any) => s.is_billable === false);
  const totalBillableHours = billableSessions.reduce((s: number, sess: any) => s + (Number(sess.duration_hours) || 0), 0);
  const totalNonBillableHours = nonBillableSessions.reduce((s: number, sess: any) => s + (Number(sess.duration_hours) || 0), 0);
  const totalBillableAmount = billableSessions.reduce((s: number, sess: any) => {
    const rate = Number(sess.service_plans?.hourly_rate) || 0;
    return s + (Number(sess.duration_hours) || 0) * rate;
  }, 0);
  const totalNonBillableAmount = nonBillableSessions.reduce((s: number, sess: any) => {
    const rate = Number(sess.service_plans?.hourly_rate) || 0;
    return s + (Number(sess.duration_hours) || 0) * rate;
  }, 0);

  return (
    <>
      <Header title="Delivery (Sessions réalisées)" />
      <div className="p-6 space-y-6">
        <div className="grid gap-3 md:grid-cols-5">
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Sessions réalisées</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a" }}>{doneSessions.length}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Heures délivrées</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a6b9c" }}>{totalHours}h</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Heures facturables</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#27ae60" }}>{totalBillableHours}h</div>
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
