import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoicesTable } from "@/components/finance/invoices-table";
import { createClient } from "@/lib/supabase/server";
import { Receipt, CheckCircle, Clock, Banknote } from "lucide-react";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function InvoicesPage() {
  const supabase = await createClient();

  const [
    { data: invoices },
    { data: wonDeals },
  ] = await Promise.all([
    supabase.from("invoices").select("*, companies(name)").order("month", { ascending: false }),
    supabase.from("deals").select("id, name, amount, company_id, companies(id, name)").eq("stage", "closed_won").order("close_date", { ascending: false }),
  ]);

  const items = invoices ?? [];
  const totalAmount = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const paidAmount = items.filter((i) => i.is_paid).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const pendingAmount = totalAmount - paidAmount;
  const paidCount = items.filter((i) => i.is_paid).length;

  return (
    <>
      <Header title="Facturation" />
      <div className="p-6 space-y-6">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Total facturé</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a" }}>{formatCurrency(totalAmount)}</div>
            </div>
            <Receipt style={{ width: 16, height: 16, color: "#1a6b9c" }} />
          </div>
          <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Encaissé</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#27ae60" }}>{formatCurrency(paidAmount)}</div>
            </div>
            <CheckCircle style={{ width: 16, height: 16, color: "#27ae60" }} />
          </div>
          <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>En attente</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#FF6B35" }}>{formatCurrency(pendingAmount)}</div>
            </div>
            <Clock style={{ width: 16, height: 16, color: "#FF6B35" }} />
          </div>
          <div className="lca-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Factures payées</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a" }}>{paidCount}/{items.length}</div>
            </div>
            <Banknote style={{ width: 16, height: 16, color: "#8399a9" }} />
          </div>
        </div>

        <InvoicesTable invoices={items} wonDeals={(wonDeals ?? []) as any} />
      </div>
    </>
  );
}
