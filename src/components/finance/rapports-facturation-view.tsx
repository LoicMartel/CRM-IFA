"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { X, Building2, Handshake, Calendar, Receipt, Pencil, Trash2 } from "lucide-react";

type R = Record<string, unknown>;

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

const PIE_COLORS = ["#1a6b9c", "#FF6B35", "#2ecc71", "#8e44ad", "#e74c3c", "#f39c12", "#1abc9c", "#8399a9"];

const STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  facturable: { label: "Facturable", bg: "#fff3e0", text: "#e65100" },
  facture: { label: "Facturé", bg: "#e8f0fe", text: "#0d4f7a" },
  paye: { label: "Payé", bg: "#e8f5e9", text: "#2e7d32" },
};

export function RapportsFacturationView({ invoices, wonDeals, companies, teamMembers }: {
  invoices: R[]; wonDeals: R[]; companies: R[]; teamMembers: R[];
}) {
  const router = useRouter();
  const [selectedReport, setSelectedReport] = useState("facturable");
  const [viewInvoice, setViewInvoice] = useState<R | null>(null);
  const [periodMode, setPeriodMode] = useState<"fiscal" | "month" | "custom">("fiscal");
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [customFrom, setCustomFrom] = useState("2025-09-01");
  const [customTo, setCustomTo] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });

  // Period filter helper
  function inPeriod(dateStr: string) {
    const date = dateStr?.split("T")[0] ?? "";
    if (periodMode === "fiscal") {
      const now = new Date();
      const y = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
      return date >= `${y}-09-01` && date <= `${y + 1}-08-31`;
    }
    if (periodMode === "month") return date.startsWith(filterMonth);
    if (periodMode === "custom") return date >= customFrom && date <= customTo;
    return true;
  }

  // ====== REPORT: FACTURABLE ======
  function renderFacturable() {
    const filtered = invoices.filter((inv: R) => inv.status === "facturable" && inPeriod(inv.month as string));

    const totalAmount = filtered.reduce((s: number, inv: R) => s + (Number(inv.amount) || 0), 0);

    // By company
    const byCompany: Record<string, { name: string; amount: number; count: number }> = {};
    filtered.forEach((inv: R) => {
      const comp = inv.companies as { id: string; name: string } | null;
      const key = comp?.id ?? "unknown";
      const name = comp?.name ?? "Non assigné";
      if (!byCompany[key]) byCompany[key] = { name, amount: 0, count: 0 };
      byCompany[key].amount += Number(inv.amount) || 0;
      byCompany[key].count += 1;
    });
    const companyData = Object.values(byCompany).sort((a, b) => b.amount - a.amount);

    // By month
    const byMonth: Record<string, number> = {};
    filtered.forEach((inv: R) => {
      const mStr = (inv.month as string).slice(0, 7);
      byMonth[mStr] = (byMonth[mStr] || 0) + (Number(inv.amount) || 0);
    });
    const monthData = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])).map(([m, amount]) => {
      const d = new Date(m + "-01");
      return { month: format(d, "MMM yy", { locale: fr }), montant: amount };
    });

    // By deal
    const byDeal: Record<string, { name: string; company: string; amount: number; count: number }> = {};
    filtered.forEach((inv: R) => {
      const deal = inv.deals as { id: string; name: string; amount: number; team_members: { first_name: string; last_name: string } | null } | null;
      const key = deal?.id ?? "unknown";
      const name = deal?.name ?? "Sans deal";
      const comp = inv.companies as { name: string } | null;
      if (!byDeal[key]) byDeal[key] = { name, company: comp?.name ?? "—", amount: 0, count: 0 };
      byDeal[key].amount += Number(inv.amount) || 0;
      byDeal[key].count += 1;
    });
    const dealData = Object.values(byDeal).sort((a, b) => b.amount - a.amount);

    // Pie data for companies
    const pieData = companyData.map(c => ({ name: c.name, value: c.amount }));

    return (
      <>
        {/* KPIs */}
        <div className="grid gap-3 md:grid-cols-4">
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Total facturable</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#e65100" }}>{fmt(totalAmount)}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Nombre de factures</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a2a3a" }}>{filtered.length}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Clients concernés</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a6b9c" }}>{companyData.length}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Montant moyen</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#FF6B35" }}>{filtered.length > 0 ? fmt(totalAmount / filtered.length) : "0 €"}</div>
          </div>
        </div>

        {/* Detail all invoices */}
        <div className="lca-card">
          <div className="lca-bar-gradient" />
          <div style={{ padding: 16 }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 12 }}>Liste des factures facturables</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Nom facture</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Client</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Deal</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Émission</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Financement</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Échéance</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "right" }}>Montant</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} style={{ textAlign: "center", color: "#8399a9", padding: 24 }}>Aucune facture</TableCell></TableRow>
                ) : filtered.map((inv: R) => {
                  const comp = inv.companies as { id: string; name: string } | null;
                  const deal = inv.deals as { name: string } | null;
                  return (
                    <TableRow key={inv.id as string} className="hover:bg-[#f0f7fb]">
                      <TableCell><span onClick={() => setViewInvoice(inv)} style={{ fontSize: 13, fontWeight: 600, color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>{(inv.invoice_name as string) || (inv.client_name as string)}</span></TableCell>
                      <TableCell style={{ fontSize: 13 }}>
                        {comp ? (
                          <span onClick={() => router.push(`/clients/${comp.id}`)} style={{ color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>
                            {comp.name}
                          </span>
                        ) : <span style={{ color: "#ccc" }}>—</span>}
                      </TableCell>
                      <TableCell style={{ fontSize: 13 }}>
                        {deal ? (
                          <span onClick={() => router.push("/deals")} style={{ color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>{deal.name}</span>
                        ) : <span style={{ color: "#ccc" }}>—</span>}
                      </TableCell>
                      <TableCell style={{ fontSize: 13, color: "#5a6f80", textTransform: "capitalize" }}>
                        {inv.month ? format(new Date(inv.month as string), "MMMM yyyy", { locale: fr }) : "—"}
                      </TableCell>
                      <TableCell style={{ fontSize: 12, color: "#5a6f80" }}>{(inv.funding_type as string) ?? "—"}</TableCell>
                      <TableCell style={{ fontSize: 13, color: "#5a6f80" }}>{inv.due_date ? format(new Date(inv.due_date as string), "dd MMM yyyy", { locale: fr }) : "—"}</TableCell>
                      <TableCell style={{ textAlign: "right", fontWeight: 700, fontSize: 13, color: "#e65100" }}>{fmt(Number(inv.amount) || 0)}</TableCell>
                      <TableCell style={{ fontSize: 12, color: "#8399a9", maxWidth: 150 }} className="truncate">{(inv.notes as string) ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="lca-card">
            <div className="lca-bar-gradient" />
            <div style={{ padding: 20 }}>
              <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>Facturable par mois</h3>
              {monthData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={monthData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf1" />
                    <XAxis dataKey="month" tick={{ fill: "#1a2a3a", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#8399a9", fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}K`} />
                    <Tooltip formatter={(v) => fmt(Number(v))} />
                    <Bar dataKey="montant" fill="#FF6B35" radius={[4, 4, 0, 0]} animationDuration={1000} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div style={{ textAlign: "center", color: "#8399a9", padding: 40 }}>Aucune donnée</div>}
            </div>
          </div>
          <div className="lca-card">
            <div className="lca-bar-gradient" />
            <div style={{ padding: 20 }}>
              <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>Répartition par client</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => { const n = (name as string).length > 15 ? (name as string).slice(0, 14) + "…" : name; return `${n} (${((percent ?? 0) * 100).toFixed(0)}%)`; }} labelLine={{ stroke: "#8399a9" }} style={{ fontSize: 11 }}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div style={{ textAlign: "center", color: "#8399a9", padding: 40 }}>Aucune donnée</div>}
            </div>
          </div>
        </div>

        {/* Detail by deal */}
        <div className="lca-card">
          <div className="lca-bar-gradient" />
          <div style={{ padding: 16 }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 12 }}>Détail par deal</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Deal</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Client</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "center" }}>Factures</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "right" }}>Montant facturable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dealData.length === 0 ? (
                  <TableRow><TableCell colSpan={4} style={{ textAlign: "center", color: "#8399a9", padding: 24 }}>Aucune facture facturable</TableCell></TableRow>
                ) : dealData.map((d, i) => (
                  <TableRow key={i} className="hover:bg-[#f0f7fb]">
                    <TableCell>
                      <span onClick={() => router.push("/deals")} style={{ fontWeight: 600, fontSize: 13, color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>{d.name}</span>
                    </TableCell>
                    <TableCell style={{ fontSize: 13, color: "#5a6f80" }}>{d.company}</TableCell>
                    <TableCell style={{ textAlign: "center", fontSize: 13, color: "#5a6f80" }}>{d.count}</TableCell>
                    <TableCell style={{ textAlign: "right", fontWeight: 700, fontSize: 13, color: "#e65100" }}>{fmt(d.amount)}</TableCell>
                  </TableRow>
                ))}
                {dealData.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={2} style={{ fontWeight: 800, color: "#0d4f7a", fontSize: 13, borderTop: "2px solid #0d4f7a" }}>Total</TableCell>
                    <TableCell style={{ textAlign: "center", fontWeight: 800, color: "#0d4f7a", fontSize: 13, borderTop: "2px solid #0d4f7a" }}>{filtered.length}</TableCell>
                    <TableCell style={{ textAlign: "right", fontWeight: 800, color: "#0d4f7a", fontSize: 13, borderTop: "2px solid #0d4f7a" }}>{fmt(totalAmount)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </>
    );
  }

  // ====== REPORT: FACTURÉ ======
  function renderFacture() {
    const filtered = invoices.filter((inv: R) => inv.status === "facture" && inPeriod(inv.month as string));
    const totalAmount = filtered.reduce((s: number, inv: R) => s + (Number(inv.amount) || 0), 0);

    // By company
    const byCompany: Record<string, { name: string; amount: number; count: number }> = {};
    filtered.forEach((inv: R) => {
      const comp = inv.companies as { id: string; name: string } | null;
      const key = comp?.id ?? "unknown";
      const name = comp?.name ?? "Non assigné";
      if (!byCompany[key]) byCompany[key] = { name, amount: 0, count: 0 };
      byCompany[key].amount += Number(inv.amount) || 0;
      byCompany[key].count += 1;
    });
    const companyData = Object.values(byCompany).sort((a, b) => b.amount - a.amount);

    // By month
    const byMonth: Record<string, number> = {};
    filtered.forEach((inv: R) => {
      const mStr = (inv.month as string).slice(0, 7);
      byMonth[mStr] = (byMonth[mStr] || 0) + (Number(inv.amount) || 0);
    });
    const monthData = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])).map(([m, amount]) => ({
      month: format(new Date(m + "-01"), "MMM yy", { locale: fr }), montant: amount,
    }));

    // By deal
    const byDeal: Record<string, { name: string; company: string; amount: number; count: number }> = {};
    filtered.forEach((inv: R) => {
      const deal = inv.deals as { id: string; name: string } | null;
      const key = deal?.id ?? "unknown";
      const name = deal?.name ?? "Sans deal";
      const comp = inv.companies as { name: string } | null;
      if (!byDeal[key]) byDeal[key] = { name, company: comp?.name ?? "—", amount: 0, count: 0 };
      byDeal[key].amount += Number(inv.amount) || 0;
      byDeal[key].count += 1;
    });
    const dealData = Object.values(byDeal).sort((a, b) => b.amount - a.amount);
    const pieData = companyData.map(c => ({ name: c.name, value: c.amount }));

    return (
      <>
        {/* KPIs */}
        <div className="grid gap-3 md:grid-cols-4">
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Total facturé</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#0d4f7a" }}>{fmt(totalAmount)}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Nombre de factures</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a2a3a" }}>{filtered.length}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Clients concernés</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a6b9c" }}>{companyData.length}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Montant moyen</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#FF6B35" }}>{filtered.length > 0 ? fmt(totalAmount / filtered.length) : "0 €"}</div>
          </div>
        </div>

        {/* Invoice list */}
        <div className="lca-card">
          <div className="lca-bar-gradient" />
          <div style={{ padding: 16 }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 12 }}>Liste des factures facturées</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Nom facture</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Client</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Deal</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Émission</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Financement</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Échéance</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "right" }}>Montant</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} style={{ textAlign: "center", color: "#8399a9", padding: 24 }}>Aucune facture facturée</TableCell></TableRow>
                ) : filtered.map((inv: R) => {
                  const comp = inv.companies as { id: string; name: string } | null;
                  const deal = inv.deals as { name: string } | null;
                  return (
                    <TableRow key={inv.id as string} className="hover:bg-[#f0f7fb]">
                      <TableCell><span onClick={() => setViewInvoice(inv)} style={{ fontSize: 13, fontWeight: 600, color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>{(inv.invoice_name as string) || (inv.client_name as string)}</span></TableCell>
                      <TableCell style={{ fontSize: 13 }}>
                        {comp ? <span onClick={() => router.push(`/clients/${comp.id}`)} style={{ color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>{comp.name}</span> : <span style={{ color: "#ccc" }}>—</span>}
                      </TableCell>
                      <TableCell style={{ fontSize: 13 }}>
                        {deal ? <span onClick={() => router.push("/deals")} style={{ color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>{deal.name}</span> : <span style={{ color: "#ccc" }}>—</span>}
                      </TableCell>
                      <TableCell style={{ fontSize: 13, color: "#5a6f80", textTransform: "capitalize" }}>{inv.month ? format(new Date(inv.month as string), "MMMM yyyy", { locale: fr }) : "—"}</TableCell>
                      <TableCell style={{ fontSize: 12, color: "#5a6f80" }}>{(inv.funding_type as string) ?? "—"}</TableCell>
                      <TableCell style={{ fontSize: 13, color: "#5a6f80" }}>{inv.due_date ? format(new Date(inv.due_date as string), "dd MMM yyyy", { locale: fr }) : "—"}</TableCell>
                      <TableCell style={{ textAlign: "right", fontWeight: 700, fontSize: 13, color: "#0d4f7a" }}>{fmt(Number(inv.amount) || 0)}</TableCell>
                      <TableCell style={{ fontSize: 12, color: "#8399a9", maxWidth: 150 }} className="truncate">{(inv.notes as string) ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="lca-card">
            <div className="lca-bar-gradient" />
            <div style={{ padding: 20 }}>
              <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>Facturé par mois</h3>
              {monthData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={monthData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf1" />
                    <XAxis dataKey="month" tick={{ fill: "#1a2a3a", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#8399a9", fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}K`} />
                    <Tooltip formatter={(v) => fmt(Number(v))} />
                    <Bar dataKey="montant" fill="#1a6b9c" radius={[4, 4, 0, 0]} animationDuration={1000} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div style={{ textAlign: "center", color: "#8399a9", padding: 40 }}>Aucune donnée</div>}
            </div>
          </div>
          <div className="lca-card">
            <div className="lca-bar-gradient" />
            <div style={{ padding: 20 }}>
              <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>Répartition par client</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => { const n = (name as string).length > 15 ? (name as string).slice(0, 14) + "…" : name; return `${n} (${((percent ?? 0) * 100).toFixed(0)}%)`; }} labelLine={{ stroke: "#8399a9" }} style={{ fontSize: 11 }}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div style={{ textAlign: "center", color: "#8399a9", padding: 40 }}>Aucune donnée</div>}
            </div>
          </div>
        </div>

        {/* Detail by deal */}
        <div className="lca-card">
          <div className="lca-bar-gradient" />
          <div style={{ padding: 16 }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 12 }}>Détail par deal</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Deal</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Client</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "center" }}>Factures</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "right" }}>Montant facturé</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dealData.length === 0 ? (
                  <TableRow><TableCell colSpan={4} style={{ textAlign: "center", color: "#8399a9", padding: 24 }}>Aucune facture facturée</TableCell></TableRow>
                ) : dealData.map((d, i) => (
                  <TableRow key={i} className="hover:bg-[#f0f7fb]">
                    <TableCell><span onClick={() => router.push("/deals")} style={{ fontWeight: 600, fontSize: 13, color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>{d.name}</span></TableCell>
                    <TableCell style={{ fontSize: 13, color: "#5a6f80" }}>{d.company}</TableCell>
                    <TableCell style={{ textAlign: "center", fontSize: 13, color: "#5a6f80" }}>{d.count}</TableCell>
                    <TableCell style={{ textAlign: "right", fontWeight: 700, fontSize: 13, color: "#0d4f7a" }}>{fmt(d.amount)}</TableCell>
                  </TableRow>
                ))}
                {dealData.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={2} style={{ fontWeight: 800, color: "#0d4f7a", fontSize: 13, borderTop: "2px solid #0d4f7a" }}>Total</TableCell>
                    <TableCell style={{ textAlign: "center", fontWeight: 800, color: "#0d4f7a", fontSize: 13, borderTop: "2px solid #0d4f7a" }}>{filtered.length}</TableCell>
                    <TableCell style={{ textAlign: "right", fontWeight: 800, color: "#0d4f7a", fontSize: 13, borderTop: "2px solid #0d4f7a" }}>{fmt(totalAmount)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </>
    );
  }

  // ====== REPORT: ENCAISSÉ ======
  function renderEncaisse() {
    const filtered = invoices.filter((inv: R) => inv.status === "paye" && inPeriod(inv.month as string));
    const totalAmount = filtered.reduce((s: number, inv: R) => s + (Number(inv.amount) || 0), 0);

    const byCompany: Record<string, { name: string; amount: number; count: number }> = {};
    filtered.forEach((inv: R) => {
      const comp = inv.companies as { id: string; name: string } | null;
      const key = comp?.id ?? "unknown";
      const name = comp?.name ?? "Non assigné";
      if (!byCompany[key]) byCompany[key] = { name, amount: 0, count: 0 };
      byCompany[key].amount += Number(inv.amount) || 0;
      byCompany[key].count += 1;
    });
    const companyData = Object.values(byCompany).sort((a, b) => b.amount - a.amount);

    const byMonth: Record<string, number> = {};
    filtered.forEach((inv: R) => {
      const mStr = (inv.month as string).slice(0, 7);
      byMonth[mStr] = (byMonth[mStr] || 0) + (Number(inv.amount) || 0);
    });
    const monthData = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])).map(([m, amount]) => ({
      month: format(new Date(m + "-01"), "MMM yy", { locale: fr }), montant: amount,
    }));

    const byDeal: Record<string, { name: string; company: string; amount: number; count: number }> = {};
    filtered.forEach((inv: R) => {
      const deal = inv.deals as { id: string; name: string } | null;
      const key = deal?.id ?? "unknown";
      const name = deal?.name ?? "Sans deal";
      const comp = inv.companies as { name: string } | null;
      if (!byDeal[key]) byDeal[key] = { name, company: comp?.name ?? "—", amount: 0, count: 0 };
      byDeal[key].amount += Number(inv.amount) || 0;
      byDeal[key].count += 1;
    });
    const dealData = Object.values(byDeal).sort((a, b) => b.amount - a.amount);
    const pieData = companyData.map(c => ({ name: c.name, value: c.amount }));

    return (
      <>
        {/* KPIs */}
        <div className="grid gap-3 md:grid-cols-4">
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Total encaissé</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#27ae60" }}>{fmt(totalAmount)}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Nombre de factures</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a2a3a" }}>{filtered.length}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Clients concernés</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a6b9c" }}>{companyData.length}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Montant moyen</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#FF6B35" }}>{filtered.length > 0 ? fmt(totalAmount / filtered.length) : "0 €"}</div>
          </div>
        </div>

        {/* Invoice list */}
        <div className="lca-card">
          <div className="lca-bar-gradient" />
          <div style={{ padding: 16 }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 12 }}>Liste des factures encaissées</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Nom facture</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Client</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Deal</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Émission</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Financement</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Échéance</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "right" }}>Montant</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} style={{ textAlign: "center", color: "#8399a9", padding: 24 }}>Aucune facture encaissée</TableCell></TableRow>
                ) : filtered.map((inv: R) => {
                  const comp = inv.companies as { id: string; name: string } | null;
                  const deal = inv.deals as { name: string } | null;
                  return (
                    <TableRow key={inv.id as string} className="hover:bg-[#f0f7fb]">
                      <TableCell><span onClick={() => setViewInvoice(inv)} style={{ fontSize: 13, fontWeight: 600, color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>{(inv.invoice_name as string) || (inv.client_name as string)}</span></TableCell>
                      <TableCell style={{ fontSize: 13 }}>
                        {comp ? <span onClick={() => router.push(`/clients/${comp.id}`)} style={{ color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>{comp.name}</span> : <span style={{ color: "#ccc" }}>—</span>}
                      </TableCell>
                      <TableCell style={{ fontSize: 13 }}>
                        {deal ? <span onClick={() => router.push("/deals")} style={{ color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>{deal.name}</span> : <span style={{ color: "#ccc" }}>—</span>}
                      </TableCell>
                      <TableCell style={{ fontSize: 13, color: "#5a6f80", textTransform: "capitalize" }}>{inv.month ? format(new Date(inv.month as string), "MMMM yyyy", { locale: fr }) : "—"}</TableCell>
                      <TableCell style={{ fontSize: 12, color: "#5a6f80" }}>{(inv.funding_type as string) ?? "—"}</TableCell>
                      <TableCell style={{ fontSize: 13, color: "#5a6f80" }}>{inv.due_date ? format(new Date(inv.due_date as string), "dd MMM yyyy", { locale: fr }) : "—"}</TableCell>
                      <TableCell style={{ textAlign: "right", fontWeight: 700, fontSize: 13, color: "#27ae60" }}>{fmt(Number(inv.amount) || 0)}</TableCell>
                      <TableCell style={{ fontSize: 12, color: "#8399a9", maxWidth: 150 }} className="truncate">{(inv.notes as string) ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="lca-card">
            <div className="lca-bar-gradient" />
            <div style={{ padding: 20 }}>
              <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>Encaissé par mois</h3>
              {monthData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={monthData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf1" />
                    <XAxis dataKey="month" tick={{ fill: "#1a2a3a", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#8399a9", fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}K`} />
                    <Tooltip formatter={(v) => fmt(Number(v))} />
                    <Bar dataKey="montant" fill="#27ae60" radius={[4, 4, 0, 0]} animationDuration={1000} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div style={{ textAlign: "center", color: "#8399a9", padding: 40 }}>Aucune donnée</div>}
            </div>
          </div>
          <div className="lca-card">
            <div className="lca-bar-gradient" />
            <div style={{ padding: 20 }}>
              <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>Répartition par client</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => { const n = (name as string).length > 15 ? (name as string).slice(0, 14) + "…" : name; return `${n} (${((percent ?? 0) * 100).toFixed(0)}%)`; }} labelLine={{ stroke: "#8399a9" }} style={{ fontSize: 11 }}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div style={{ textAlign: "center", color: "#8399a9", padding: 40 }}>Aucune donnée</div>}
            </div>
          </div>
        </div>

        {/* Detail by deal */}
        <div className="lca-card">
          <div className="lca-bar-gradient" />
          <div style={{ padding: 16 }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 12 }}>Détail par deal</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Deal</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Client</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "center" }}>Factures</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "right" }}>Montant encaissé</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dealData.length === 0 ? (
                  <TableRow><TableCell colSpan={4} style={{ textAlign: "center", color: "#8399a9", padding: 24 }}>Aucune facture encaissée</TableCell></TableRow>
                ) : dealData.map((d, i) => (
                  <TableRow key={i} className="hover:bg-[#f0f7fb]">
                    <TableCell><span onClick={() => router.push("/deals")} style={{ fontWeight: 600, fontSize: 13, color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>{d.name}</span></TableCell>
                    <TableCell style={{ fontSize: 13, color: "#5a6f80" }}>{d.company}</TableCell>
                    <TableCell style={{ textAlign: "center", fontSize: 13, color: "#5a6f80" }}>{d.count}</TableCell>
                    <TableCell style={{ textAlign: "right", fontWeight: 700, fontSize: 13, color: "#27ae60" }}>{fmt(d.amount)}</TableCell>
                  </TableRow>
                ))}
                {dealData.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={2} style={{ fontWeight: 800, color: "#0d4f7a", fontSize: 13, borderTop: "2px solid #0d4f7a" }}>Total</TableCell>
                    <TableCell style={{ textAlign: "center", fontWeight: 800, color: "#0d4f7a", fontSize: 13, borderTop: "2px solid #0d4f7a" }}>{filtered.length}</TableCell>
                    <TableCell style={{ textAlign: "right", fontWeight: 800, color: "#27ae60", fontSize: 13, borderTop: "2px solid #0d4f7a" }}>{fmt(totalAmount)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </>
    );
  }

  // ====== REPORT: EN RETARD ======
  function renderEnRetard() {
    const today = new Date().toISOString().split("T")[0];
    const filtered = invoices.filter((inv: R) =>
      (inv.status === "facturable" || inv.status === "facture") &&
      inv.due_date && (inv.due_date as string) < today &&
      inPeriod(inv.month as string)
    );
    const totalAmount = filtered.reduce((s: number, inv: R) => s + (Number(inv.amount) || 0), 0);

    const byCompany: Record<string, { name: string; amount: number; count: number }> = {};
    filtered.forEach((inv: R) => {
      const comp = inv.companies as { id: string; name: string } | null;
      const key = comp?.id ?? "unknown";
      const name = comp?.name ?? "Non assigné";
      if (!byCompany[key]) byCompany[key] = { name, amount: 0, count: 0 };
      byCompany[key].amount += Number(inv.amount) || 0;
      byCompany[key].count += 1;
    });
    const companyData = Object.values(byCompany).sort((a, b) => b.amount - a.amount);

    const byMonth: Record<string, number> = {};
    filtered.forEach((inv: R) => {
      const mStr = (inv.month as string).slice(0, 7);
      byMonth[mStr] = (byMonth[mStr] || 0) + (Number(inv.amount) || 0);
    });
    const monthData = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])).map(([m, amount]) => ({
      month: format(new Date(m + "-01"), "MMM yy", { locale: fr }), montant: amount,
    }));

    const byDeal: Record<string, { name: string; company: string; amount: number; count: number }> = {};
    filtered.forEach((inv: R) => {
      const deal = inv.deals as { id: string; name: string } | null;
      const key = deal?.id ?? "unknown";
      const name = deal?.name ?? "Sans deal";
      const comp = inv.companies as { name: string } | null;
      if (!byDeal[key]) byDeal[key] = { name, company: comp?.name ?? "—", amount: 0, count: 0 };
      byDeal[key].amount += Number(inv.amount) || 0;
      byDeal[key].count += 1;
    });
    const dealData = Object.values(byDeal).sort((a, b) => b.amount - a.amount);
    const pieData = companyData.map(c => ({ name: c.name, value: c.amount }));

    // Days overdue helper
    function daysOverdue(dueDate: string) {
      const diff = Math.floor((new Date().getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
      return diff;
    }

    return (
      <>
        {/* KPIs */}
        <div className="grid gap-3 md:grid-cols-4">
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Total en retard</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#e74c3c" }}>{fmt(totalAmount)}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Factures en retard</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a2a3a" }}>{filtered.length}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Clients concernés</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a6b9c" }}>{companyData.length}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Montant moyen</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#FF6B35" }}>{filtered.length > 0 ? fmt(totalAmount / filtered.length) : "0 €"}</div>
          </div>
        </div>

        {/* Invoice list */}
        <div className="lca-card">
          <div className="lca-bar-gradient" />
          <div style={{ padding: 16 }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 12 }}>Factures en retard</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Nom facture</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Client</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Deal</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Émission</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Financement</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Échéance</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Retard</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "right" }}>Montant</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} style={{ textAlign: "center", color: "#8399a9", padding: 24 }}>Aucune facture en retard</TableCell></TableRow>
                ) : filtered.sort((a: R, b: R) => (a.due_date as string).localeCompare(b.due_date as string)).map((inv: R) => {
                  const comp = inv.companies as { id: string; name: string } | null;
                  const deal = inv.deals as { name: string } | null;
                  const days = daysOverdue(inv.due_date as string);
                  return (
                    <TableRow key={inv.id as string} className="hover:bg-[#f0f7fb]">
                      <TableCell><span onClick={() => setViewInvoice(inv)} style={{ fontSize: 13, fontWeight: 600, color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>{(inv.invoice_name as string) || (inv.client_name as string)}</span></TableCell>
                      <TableCell style={{ fontSize: 13 }}>
                        {comp ? <span onClick={() => router.push(`/clients/${comp.id}`)} style={{ color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>{comp.name}</span> : <span style={{ color: "#ccc" }}>—</span>}
                      </TableCell>
                      <TableCell style={{ fontSize: 13 }}>
                        {deal ? <span onClick={() => router.push("/deals")} style={{ color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>{deal.name}</span> : <span style={{ color: "#ccc" }}>—</span>}
                      </TableCell>
                      <TableCell style={{ fontSize: 13, color: "#5a6f80", textTransform: "capitalize" }}>{inv.month ? format(new Date(inv.month as string), "MMMM yyyy", { locale: fr }) : "—"}</TableCell>
                      <TableCell style={{ fontSize: 12, color: "#5a6f80" }}>{(inv.funding_type as string) ?? "—"}</TableCell>
                      <TableCell style={{ fontSize: 13, color: "#e74c3c", fontWeight: 600 }}>{format(new Date(inv.due_date as string), "dd MMM yyyy", { locale: fr })}</TableCell>
                      <TableCell>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: days > 30 ? "#fce4ec" : "#fff3e0", color: days > 30 ? "#c62828" : "#e65100" }}>
                          {days}j
                        </span>
                      </TableCell>
                      <TableCell style={{ textAlign: "right", fontWeight: 700, fontSize: 13, color: "#e74c3c" }}>{fmt(Number(inv.amount) || 0)}</TableCell>
                      <TableCell style={{ fontSize: 12, color: "#8399a9", maxWidth: 150 }} className="truncate">{(inv.notes as string) ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="lca-card">
            <div className="lca-bar-gradient" />
            <div style={{ padding: 20 }}>
              <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>En retard par mois</h3>
              {monthData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={monthData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf1" />
                    <XAxis dataKey="month" tick={{ fill: "#1a2a3a", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#8399a9", fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}K`} />
                    <Tooltip formatter={(v) => fmt(Number(v))} />
                    <Bar dataKey="montant" fill="#e74c3c" radius={[4, 4, 0, 0]} animationDuration={1000} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div style={{ textAlign: "center", color: "#8399a9", padding: 40 }}>Aucune donnée</div>}
            </div>
          </div>
          <div className="lca-card">
            <div className="lca-bar-gradient" />
            <div style={{ padding: 20 }}>
              <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>Répartition par client</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => { const n = (name as string).length > 15 ? (name as string).slice(0, 14) + "…" : name; return `${n} (${((percent ?? 0) * 100).toFixed(0)}%)`; }} labelLine={{ stroke: "#8399a9" }} style={{ fontSize: 11 }}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div style={{ textAlign: "center", color: "#8399a9", padding: 40 }}>Aucune donnée</div>}
            </div>
          </div>
        </div>

        {/* Detail by deal */}
        <div className="lca-card">
          <div className="lca-bar-gradient" />
          <div style={{ padding: 16 }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 12 }}>Détail par deal</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Deal</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Client</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "center" }}>Factures</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "right" }}>Montant en retard</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dealData.length === 0 ? (
                  <TableRow><TableCell colSpan={4} style={{ textAlign: "center", color: "#8399a9", padding: 24 }}>Aucune facture en retard</TableCell></TableRow>
                ) : dealData.map((d, i) => (
                  <TableRow key={i} className="hover:bg-[#f0f7fb]">
                    <TableCell><span onClick={() => router.push("/deals")} style={{ fontWeight: 600, fontSize: 13, color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>{d.name}</span></TableCell>
                    <TableCell style={{ fontSize: 13, color: "#5a6f80" }}>{d.company}</TableCell>
                    <TableCell style={{ textAlign: "center", fontSize: 13, color: "#5a6f80" }}>{d.count}</TableCell>
                    <TableCell style={{ textAlign: "right", fontWeight: 700, fontSize: 13, color: "#e74c3c" }}>{fmt(d.amount)}</TableCell>
                  </TableRow>
                ))}
                {dealData.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={2} style={{ fontWeight: 800, color: "#0d4f7a", fontSize: 13, borderTop: "2px solid #0d4f7a" }}>Total</TableCell>
                    <TableCell style={{ textAlign: "center", fontWeight: 800, color: "#0d4f7a", fontSize: 13, borderTop: "2px solid #0d4f7a" }}>{filtered.length}</TableCell>
                    <TableCell style={{ textAlign: "right", fontWeight: 800, color: "#e74c3c", fontSize: 13, borderTop: "2px solid #0d4f7a" }}>{fmt(totalAmount)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </>
    );
  }

  // ====== REPORT: NON FACTURÉ / PARTIELLEMENT FACTURÉ ======
  function renderNonFacture() {
    // Won deals filtered by period
    const filteredDeals = wonDeals.filter((d: R) => inPeriod((d.close_date ?? d.created_at) as string));

    // For each deal, compute total invoiced (all statuses)
    const dealRows = filteredDeals.map((d: R) => {
      const dealId = d.id as string;
      const dealAmount = Number(d.amount) || 0;
      const dealInvs = invoices.filter((inv: R) => inv.deal_id === dealId);
      const totalInvoiced = dealInvs.reduce((s: number, inv: R) => s + (Number(inv.amount) || 0), 0);
      const remaining = dealAmount - totalInvoiced;
      const comp = d.companies as { id: string; name: string } | null;
      const owner = d.team_members as { first_name: string; last_name: string } | null;
      return {
        id: dealId,
        name: d.name as string,
        companyId: comp?.id ?? "",
        companyName: comp?.name ?? "—",
        ownerInitials: owner ? `${owner.first_name[0]}${owner.last_name[0]}` : "",
        closeDate: (d.close_date ?? d.created_at) as string,
        dealAmount,
        totalInvoiced,
        remaining,
        invoiceCount: dealInvs.length,
      };
    }).filter(d => d.remaining > 0).sort((a, b) => b.remaining - a.remaining);

    const totalRemaining = dealRows.reduce((s, d) => s + d.remaining, 0);
    const totalDealAmount = dealRows.reduce((s, d) => s + d.dealAmount, 0);
    const totalInvoiced = dealRows.reduce((s, d) => s + d.totalInvoiced, 0);

    // By company
    const byCompany: Record<string, { name: string; remaining: number }> = {};
    dealRows.forEach(d => {
      if (!byCompany[d.companyId]) byCompany[d.companyId] = { name: d.companyName, remaining: 0 };
      byCompany[d.companyId].remaining += d.remaining;
    });
    const companyChartData = Object.values(byCompany).sort((a, b) => b.remaining - a.remaining);
    const pieData = companyChartData.map(c => ({ name: c.name, value: c.remaining }));

    return (
      <>
        {/* KPIs */}
        <div className="grid gap-3 md:grid-cols-4">
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Reste à facturer</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#e74c3c" }}>{fmt(totalRemaining)}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Deals concernés</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a2a3a" }}>{dealRows.length}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Montant total deals</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a6b9c" }}>{fmt(totalDealAmount)}</div>
          </div>
          <div className="lca-card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Déjà facturé</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#FF6B35" }}>{fmt(totalInvoiced)}</div>
          </div>
        </div>

        {/* Table */}
        {/* Detail table with same headers as facturable report */}
        <div className="lca-card">
          <div className="lca-bar-gradient" />
          <div style={{ padding: 16 }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 12 }}>Deals non facturés ou partiellement facturés</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Nom facture</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Client</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Deal</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Émission</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Financement</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Échéance</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "right" }}>Montant</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dealRows.length === 0 ? (
                  <TableRow><TableCell colSpan={8} style={{ textAlign: "center", color: "#8399a9", padding: 24 }}>Tous les deals sont entièrement facturés</TableCell></TableRow>
                ) : (() => {
                  // Build rows: for deals with partial invoices, show each invoice; for deals with no invoices, show one row
                  const rows: { key: string; invoiceName: string; companyName: string; companyId: string; dealName: string; month: string; funding: string; dueDate: string; amount: number; notes: string }[] = [];
                  dealRows.forEach(d => {
                    const dealInvs = invoices.filter((inv: R) => inv.deal_id === d.id);
                    if (dealInvs.length > 0) {
                      dealInvs.forEach((inv: R) => {
                        rows.push({
                          key: inv.id as string,
                          invoiceName: (inv.invoice_name as string) || d.name,
                          companyName: d.companyName,
                          companyId: d.companyId,
                          dealName: d.name,
                          month: inv.month as string,
                          funding: (inv.funding_type as string) ?? "",
                          dueDate: (inv.due_date as string) ?? "",
                          amount: Number(inv.amount) || 0,
                          notes: (inv.notes as string) ?? "",
                        });
                      });
                    } else {
                      rows.push({
                        key: d.id,
                        invoiceName: "Aucune facture",
                        companyName: d.companyName,
                        companyId: d.companyId,
                        dealName: d.name,
                        month: "",
                        funding: "",
                        dueDate: "",
                        amount: d.dealAmount,
                        notes: "À facturer",
                      });
                    }
                  });
                  return rows.map(r => (
                    <TableRow key={r.key} className="hover:bg-[#f0f7fb]">
                      <TableCell><span onClick={() => { const found = invoices.find((inv: R) => inv.id === r.key); if (found) setViewInvoice(found); else router.push("/invoices"); }} style={{ fontSize: 13, fontWeight: 600, color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>{r.invoiceName}</span></TableCell>
                      <TableCell>
                        <span onClick={() => router.push(`/clients/${r.companyId}`)} style={{ fontSize: 13, color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>{r.companyName}</span>
                      </TableCell>
                      <TableCell>
                        <span onClick={() => router.push("/deals")} style={{ fontSize: 13, color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>{r.dealName}</span>
                      </TableCell>
                      <TableCell style={{ fontSize: 13, color: "#5a6f80", textTransform: "capitalize" }}>
                        {r.month ? format(new Date(r.month), "MMMM yyyy", { locale: fr }) : "—"}
                      </TableCell>
                      <TableCell style={{ fontSize: 12, color: "#5a6f80" }}>{r.funding || "—"}</TableCell>
                      <TableCell style={{ fontSize: 13, color: "#5a6f80" }}>{r.dueDate ? format(new Date(r.dueDate), "dd MMM yyyy", { locale: fr }) : "—"}</TableCell>
                      <TableCell style={{ textAlign: "right", fontWeight: 700, fontSize: 13, color: "#e65100" }}>{fmt(r.amount)}</TableCell>
                      <TableCell style={{ fontSize: 12, color: "#8399a9" }}>{r.notes || "—"}</TableCell>
                    </TableRow>
                  ));
                })()}
                {dealRows.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={5} style={{ fontWeight: 800, color: "#0d4f7a", fontSize: 13, borderTop: "2px solid #0d4f7a" }}>Total reste à facturer</TableCell>
                    <TableCell style={{ textAlign: "right", fontWeight: 800, color: "#e74c3c", fontSize: 13, borderTop: "2px solid #0d4f7a" }}>{fmt(totalRemaining)}</TableCell>
                    <TableCell style={{ borderTop: "2px solid #0d4f7a" }}></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="lca-card">
            <div className="lca-bar-gradient" />
            <div style={{ padding: 20 }}>
              <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>Reste à facturer par client</h3>
              {companyChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={companyChartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf1" />
                    <XAxis dataKey="name" tick={{ fill: "#1a2a3a", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#8399a9", fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}K`} />
                    <Tooltip formatter={(v) => fmt(Number(v))} />
                    <Bar dataKey="remaining" name="Reste à facturer" fill="#e74c3c" radius={[4, 4, 0, 0]} animationDuration={1000} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div style={{ textAlign: "center", color: "#8399a9", padding: 40 }}>Aucune donnée</div>}
            </div>
          </div>
          <div className="lca-card">
            <div className="lca-bar-gradient" />
            <div style={{ padding: 20 }}>
              <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 16 }}>Répartition par client</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => { const n = (name as string).length > 15 ? (name as string).slice(0, 14) + "…" : name; return `${n} (${((percent ?? 0) * 100).toFixed(0)}%)`; }} labelLine={{ stroke: "#8399a9" }} style={{ fontSize: 11 }}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div style={{ textAlign: "center", color: "#8399a9", padding: 40 }}>Aucune donnée</div>}
            </div>
          </div>
        </div>

        {/* Detail by deal */}
        <div className="lca-card">
          <div className="lca-bar-gradient" />
          <div style={{ padding: 16 }}>
            <h3 style={{ fontWeight: 700, color: "#1a2a3a", marginBottom: 12 }}>Détail par deal</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Deal</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12 }}>Client</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "right" }}>Montant deal</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "right" }}>Facturé</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "right" }}>Reste à facturer</TableHead>
                  <TableHead style={{ fontWeight: 700, color: "#1a6b9c", fontSize: 12, textAlign: "center" }}>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dealRows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} style={{ textAlign: "center", color: "#8399a9", padding: 24 }}>Tous les deals sont entièrement facturés</TableCell></TableRow>
                ) : dealRows.map(d => (
                  <TableRow key={d.id} className="hover:bg-[#f0f7fb]">
                    <TableCell>
                      <span onClick={() => router.push("/deals")} style={{ fontWeight: 600, fontSize: 13, color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>{d.name}</span>
                    </TableCell>
                    <TableCell>
                      <span onClick={() => router.push(`/clients/${d.companyId}`)} style={{ fontSize: 13, color: "#1a6b9c", textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}>{d.companyName}</span>
                    </TableCell>
                    <TableCell style={{ textAlign: "right", fontWeight: 700, fontSize: 13, color: "#1a2a3a" }}>{fmt(d.dealAmount)}</TableCell>
                    <TableCell style={{ textAlign: "right", fontSize: 13, color: d.totalInvoiced > 0 ? "#FF6B35" : "#ccc" }}>{fmt(d.totalInvoiced)}</TableCell>
                    <TableCell style={{ textAlign: "right", fontWeight: 700, fontSize: 13, color: "#e74c3c" }}>{fmt(d.remaining)}</TableCell>
                    <TableCell style={{ textAlign: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: d.invoiceCount === 0 ? "#fce4ec" : "#fff3e0", color: d.invoiceCount === 0 ? "#c62828" : "#e65100" }}>
                        {d.invoiceCount === 0 ? "Non facturé" : "Partiel"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {dealRows.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={2} style={{ fontWeight: 800, color: "#0d4f7a", fontSize: 13, borderTop: "2px solid #0d4f7a" }}>Total</TableCell>
                    <TableCell style={{ textAlign: "right", fontWeight: 800, color: "#0d4f7a", fontSize: 13, borderTop: "2px solid #0d4f7a" }}>{fmt(totalDealAmount)}</TableCell>
                    <TableCell style={{ textAlign: "right", fontWeight: 800, color: "#0d4f7a", fontSize: 13, borderTop: "2px solid #0d4f7a" }}>{fmt(totalInvoiced)}</TableCell>
                    <TableCell style={{ textAlign: "right", fontWeight: 800, color: "#e74c3c", fontSize: 13, borderTop: "2px solid #0d4f7a" }}>{fmt(totalRemaining)}</TableCell>
                    <TableCell style={{ borderTop: "2px solid #0d4f7a" }}></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-5">
      {/* Selector + Period */}
      <div className="flex items-center gap-4 flex-wrap">
        <select
          style={{ height: 40, borderRadius: 10, border: "1px solid #dce8f0", background: "white", padding: "0 16px", fontSize: 14, fontWeight: 600, color: "#1a2a3a", minWidth: 250 }}
          value={selectedReport}
          onChange={(e) => setSelectedReport(e.target.value)}
        >
          <option value="facturable">Facturable</option>
          <option value="facture">Facturé</option>
          <option value="encaisse">Encaissé</option>
          <option value="en_retard">En retard</option>
          <option value="non_facture">Non facturé / Partiellement facturé</option>
        </select>

        <select
          value={periodMode}
          onChange={(e) => setPeriodMode(e.target.value as "fiscal" | "month" | "custom")}
          style={{ height: 40, borderRadius: 10, border: "1px solid #dce8f0", padding: "0 12px", fontSize: 13, color: "#1a2a3a" }}
        >
          <option value="fiscal">Année fiscale</option>
          <option value="month">Mois</option>
          <option value="custom">Personnalisé</option>
        </select>
        {periodMode === "month" && (
          <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} style={{ height: 40, borderRadius: 10, border: "1px solid #dce8f0", padding: "0 12px", fontSize: 13, color: "#1a2a3a" }} />
        )}
        {periodMode === "custom" && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={{ height: 40, borderRadius: 10, border: "1px solid #dce8f0", padding: "0 12px", fontSize: 13 }} />
            <span style={{ color: "#8399a9" }}>→</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={{ height: 40, borderRadius: 10, border: "1px solid #dce8f0", padding: "0 12px", fontSize: 13 }} />
          </div>
        )}
      </div>

      {/* Report content */}
      {selectedReport === "facturable" && renderFacturable()}
      {selectedReport === "facture" && renderFacture()}
      {selectedReport === "encaisse" && renderEncaisse()}
      {selectedReport === "en_retard" && renderEnRetard()}
      {selectedReport === "non_facture" && renderNonFacture()}

      {/* Invoice detail popup */}
      {viewInvoice && (() => {
        const inv = viewInvoice;
        const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = { facturable: { label: "Facturable", bg: "#fff3e0", text: "#e65100" }, facture: { label: "Facturé", bg: "#e8f0fe", text: "#0d4f7a" }, paye: { label: "Payé", bg: "#e8f5e9", text: "#2e7d32" } };
        const st = STATUS_MAP[(inv.status as string)] ?? STATUS_MAP.facturable;
        const deal = inv.deals as { id: string; name: string } | null;
        const comp = inv.companies as { id: string; name: string } | null;
        const isOverdue = !!(inv.due_date && (inv.due_date as string) < new Date().toISOString().split("T")[0] && inv.status !== "paye");

        return (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={(e) => { if (e.target === e.currentTarget) setViewInvoice(null); }}
          >
            <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden", maxHeight: "85vh", overflowY: "auto" }}>
              {/* Header */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontWeight: 700, fontSize: 18, color: "#1a2a3a", margin: 0 }}>{String(inv.invoice_name || inv.client_name)}</h3>
                <button onClick={() => setViewInvoice(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8399a9", padding: 4 }}>
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div style={{ padding: 20 }} className="space-y-4">
                {/* Status */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 12px", borderRadius: 999, background: st.bg, color: st.text }}>{st.label}</span>
                  {isOverdue && <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "#fce4ec", color: "#c62828" }}>En retard</span>}
                  {String(inv.funding_type || "") && <span style={{ fontSize: 12, color: "#8399a9" }}>{String(inv.funding_type)}</span>}
                </div>

                {/* Infos */}
                <div style={{ background: "#f5f7fa", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  {comp && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Building2 style={{ width: 14, height: 14, color: "#8399a9" }} />
                      <span onClick={() => { setViewInvoice(null); router.push(`/clients/${comp.id}`); }} style={{ fontSize: 13, color: "#1a6b9c", textDecoration: "underline", cursor: "pointer" }}>{comp.name}</span>
                    </div>
                  )}
                  {deal && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Handshake style={{ width: 14, height: 14, color: "#8399a9" }} />
                      <span onClick={() => { setViewInvoice(null); router.push("/deals"); }} style={{ fontSize: 13, color: "#1a6b9c", textDecoration: "underline", cursor: "pointer" }}>{deal.name}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Calendar style={{ width: 14, height: 14, color: "#8399a9" }} />
                    <span style={{ fontSize: 12, color: "#8399a9" }}>Émission : <span style={{ textTransform: "capitalize" }}>{inv.month ? format(new Date(inv.month as string), "MMMM yyyy", { locale: fr }) : "—"}</span></span>
                  </div>
                  {String(inv.due_date || "") && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Calendar style={{ width: 14, height: 14, color: "#8399a9" }} />
                      <span style={{ fontSize: 12, color: isOverdue ? "#e74c3c" : "#8399a9" }}>Échéance : {format(new Date(inv.due_date as string), "d MMMM yyyy", { locale: fr })}</span>
                    </div>
                  )}
                </div>

                {/* Montant */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ background: "#f5f7fa", borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Montant</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a", marginTop: 2 }}>{fmt(Number(inv.amount) || 0)}</div>
                  </div>
                  <div style={{ background: "#f5f7fa", borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9" }}>Financement</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2a3a", marginTop: 2 }}>{String(inv.funding_type || "—")}</div>
                  </div>
                </div>

                {/* Notes */}
                {String(inv.notes || "") && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8399a9", marginBottom: 4 }}>Notes</div>
                    <p style={{ fontSize: 13, color: "#1a2a3a", whiteSpace: "pre-wrap" }}>{String(inv.notes)}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ display: "flex", gap: 10, padding: "14px 20px", borderTop: "1px solid #e8ecf1", background: "#f8fbfd" }}>
                <button onClick={() => { setViewInvoice(null); router.push("/invoices"); }} style={{ flex: 1, height: 40, borderRadius: 8, background: "#FF6B35", color: "white", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Pencil className="h-4 w-4" /> Modifier la facture
                </button>
                <button onClick={() => setViewInvoice(null)} style={{ height: 40, borderRadius: 8, background: "#e8ecf1", color: "#5a6f80", fontSize: 13, fontWeight: 600, padding: "0 18px", border: "none", cursor: "pointer" }}>
                  Fermer
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
