"use client";

import { useState } from "react";
import { Calculator, Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { CotationModal } from "./cotation-modal";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Deal {
  id: string;
  name: string;
  amount: number | null;
  companies: { name: string } | null;
}

interface Company {
  id: string;
  name: string;
}

interface Quotation {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  nb_learners: number;
  nb_rise_up: number;
  total_ht: number | null;
  total_presentiel_days: number | null;
  total_vt_sessions: number | null;
  deal_id: string | null;
  months: Record<string, { presentiel: number; vt: number }>;
  tjm_lca: number;
  base_coeff: number;
  travel_coeff: number;
  prep_coeff: number;
  cost_per_day_presentiel: number;
  rise_up_cost_per_license: number;
  vt_duration_hours: number;
  presentiel_hours_per_day: number;
  notes: string | null;
  created_at: string;
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  company_id: string | null;
}

interface ResourceLink {
  id: string;
  category: string;
  name: string;
  description: string | null;
  url: string;
  display_order: number;
}

interface Props {
  deals: Deal[];
  companies: Company[];
  contacts: Contact[];
  quotations: Quotation[];
  resourceLinks: ResourceLink[];
}

const CARD_COLORS = [
  { bg: "linear-gradient(135deg, #e65100 0%, #E8732A 100%)", border: "#E8732A", shadow: "rgba(255,107,53,0.12)" },
  { bg: "linear-gradient(135deg, #1e8449 0%, #27ae60 100%)", border: "#27ae60", shadow: "rgba(39,174,96,0.12)" },
  { bg: "linear-gradient(135deg, #6c3483 0%, #8e44ad 100%)", border: "#8e44ad", shadow: "rgba(142,68,173,0.12)" },
  { bg: "linear-gradient(135deg, #1a5276 0%, #2980b9 100%)", border: "#2980b9", shadow: "rgba(41,128,185,0.12)" },
  { bg: "linear-gradient(135deg, #7b341e 0%, #c0392b 100%)", border: "#c0392b", shadow: "rgba(192,57,43,0.12)" },
  { bg: "linear-gradient(135deg, #1a6b9c 0%, #2196f3 100%)", border: "#2196f3", shadow: "rgba(33,150,243,0.12)" },
];

export function RessourcesCommercialesView({ deals, companies, contacts, quotations, resourceLinks }: Props) {
  const [cotationOpen, setCotationOpen] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const router = useRouter();

  const fmtE = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
  const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }); }
    catch { return d; }
  };

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette cotation ?")) return;
    const supabase = createClient();
    await supabase.from("quotations").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {/* Tool cards */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* Cotation tool (always present) */}
        <div
          onClick={() => { setEditingQuotation(null); setCotationOpen(true); }}
          style={{
            padding: "28px 24px", borderRadius: 14, cursor: "pointer",
            border: "1px solid #dce8f0", background: "white",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            display: "flex", alignItems: "center", gap: 16,
            transition: "all 0.15s ease", width: 320,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#1E2A5A"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(26,107,156,0.12)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#dce8f0"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)"; }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: "linear-gradient(135deg, #0f1630 0%, #1E2A5A 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Calculator style={{ width: 24, height: 24, color: "white" }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1a2a3a" }}>Outil de Cotation</div>
            <div style={{ fontSize: 12, color: "#8399a9", marginTop: 2 }}>Chiffrer un accompagnement client</div>
          </div>
        </div>

        {/* Dynamic resource links from database */}
        {resourceLinks.map((link, i) => {
          const color = CARD_COLORS[i % CARD_COLORS.length];
          return (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "28px 24px", borderRadius: 14, cursor: "pointer",
                border: "1px solid #dce8f0", background: "white",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                display: "flex", alignItems: "center", gap: 16,
                transition: "all 0.15s ease", width: 320, textDecoration: "none",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = color.border; e.currentTarget.style.boxShadow = `0 4px 16px ${color.shadow}`; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#dce8f0"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)"; }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: color.bg,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <ExternalLink style={{ width: 24, height: 24, color: "white" }} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1a2a3a" }}>{link.name}</div>
                {link.description && <div style={{ fontSize: 12, color: "#8399a9", marginTop: 2 }}>{link.description}</div>}
              </div>
            </a>
          );
        })}
      </div>

      {/* Saved quotations list */}
      {quotations.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a2a3a", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            Cotations sauvegardées
            <span style={{ fontSize: 11, fontWeight: 600, color: "#8399a9" }}>({quotations.length})</span>
          </h3>
          <div style={{ borderRadius: 12, border: "1px solid #e8ecf1", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fbfd" }}>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#1E2A5A" }}>Date</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#1E2A5A" }}>Entreprise</th>
                  <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, color: "#1E2A5A" }}>Apprenants</th>
                  <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, color: "#1E2A5A" }}>Présentiel</th>
                  <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, color: "#1E2A5A" }}>VT</th>
                  <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, color: "#1E2A5A" }}>Rise Up</th>
                  <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#1E2A5A" }}>Total HT</th>
                  <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, color: "#1E2A5A", width: 80 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((q) => (
                  <tr key={q.id} style={{ borderTop: "1px solid #e8ecf1" }}>
                    <td style={{ padding: "10px 14px", color: "#5a6f80" }}>{fmtDate(q.created_at)}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 600 }}>{q.company_name || "—"}</td>
                    <td style={{ padding: "10px 8px", textAlign: "center" }}>{q.nb_learners}</td>
                    <td style={{ padding: "10px 8px", textAlign: "center" }}>{q.total_presentiel_days ?? 0}j</td>
                    <td style={{ padding: "10px 8px", textAlign: "center" }}>{q.total_vt_sessions ?? 0}</td>
                    <td style={{ padding: "10px 8px", textAlign: "center" }}>{q.nb_rise_up || 0}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#27ae60" }}>
                      {q.total_ht != null ? fmtE(Number(q.total_ht)) : "—"}
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                        <button
                          onClick={() => { setEditingQuotation(q); setCotationOpen(true); }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#1E2A5A", padding: 4 }}
                          title="Modifier"
                        >
                          <Pencil style={{ width: 14, height: 14 }} />
                        </button>
                        <button
                          onClick={() => handleDelete(q.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#e74c3c", padding: 4 }}
                          title="Supprimer"
                        >
                          <Trash2 style={{ width: 14, height: 14 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      <CotationModal
        open={cotationOpen}
        onClose={() => { setCotationOpen(false); setEditingQuotation(null); }}
        deals={deals}
        companies={companies}
        contacts={contacts}
        editQuotation={editingQuotation}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
