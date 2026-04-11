"use client";

import { useState } from "react";
import { Calculator, Plus, Pencil, Trash2, Presentation, FileText } from "lucide-react";
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

interface Props {
  deals: Deal[];
  companies: Company[];
  quotations: Quotation[];
}

export function RessourcesCommercialesView({ deals, companies, quotations }: Props) {
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
        <div
          onClick={() => { setEditingQuotation(null); setCotationOpen(true); }}
          style={{
            padding: "28px 24px", borderRadius: 14, cursor: "pointer",
            border: "1px solid #dce8f0", background: "white",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            display: "flex", alignItems: "center", gap: 16,
            transition: "all 0.15s ease", width: 320,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#1a6b9c"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(26,107,156,0.12)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#dce8f0"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)"; }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Calculator style={{ width: 24, height: 24, color: "white" }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1a2a3a" }}>Outil de Cotation</div>
            <div style={{ fontSize: 12, color: "#8399a9", marginTop: 2 }}>Chiffrer un accompagnement client</div>
          </div>
        </div>

        {/* Sales Deck */}
        <a
          href="https://drive.google.com/drive/folders/1xRTBaNRlP7ZLQOtGkMxRd-tvVCwM611y"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: "28px 24px", borderRadius: 14, cursor: "pointer",
            border: "1px solid #dce8f0", background: "white",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            display: "flex", alignItems: "center", gap: 16,
            transition: "all 0.15s ease", width: 320, textDecoration: "none",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#FF6B35"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(255,107,53,0.12)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#dce8f0"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)"; }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: "linear-gradient(135deg, #e65100 0%, #FF6B35 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Presentation style={{ width: 24, height: 24, color: "white" }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1a2a3a" }}>Sales Deck</div>
            <div style={{ fontSize: 12, color: "#8399a9", marginTop: 2 }}>Supports de présentation</div>
          </div>
        </a>

        {/* Usecases */}
        <a
          href="https://drive.google.com/drive/folders/1GaDw6mswk39rjLTVhEDlqe8gJxf2VNSI"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: "28px 24px", borderRadius: 14, cursor: "pointer",
            border: "1px solid #dce8f0", background: "white",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            display: "flex", alignItems: "center", gap: 16,
            transition: "all 0.15s ease", width: 320, textDecoration: "none",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#27ae60"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(39,174,96,0.12)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#dce8f0"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)"; }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: "linear-gradient(135deg, #1e8449 0%, #27ae60 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <FileText style={{ width: 24, height: 24, color: "white" }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1a2a3a" }}>Usecases</div>
            <div style={{ fontSize: 12, color: "#8399a9", marginTop: 2 }}>Cas clients et témoignages</div>
          </div>
        </a>
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
                  <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Date</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#1a6b9c" }}>Entreprise</th>
                  <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, color: "#1a6b9c" }}>Apprenants</th>
                  <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, color: "#1a6b9c" }}>Présentiel</th>
                  <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, color: "#1a6b9c" }}>VT</th>
                  <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, color: "#1a6b9c" }}>Rise Up</th>
                  <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#1a6b9c" }}>Total HT</th>
                  <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, color: "#1a6b9c", width: 80 }}>Actions</th>
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
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#1a6b9c", padding: 4 }}
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
        editQuotation={editingQuotation}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
