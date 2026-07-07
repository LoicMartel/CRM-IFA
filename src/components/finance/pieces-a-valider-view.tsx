"use client";

import { useEffect, useState, useCallback } from "react";
import type { PendingPiece } from "@/app/api/adv/pending/route";
import { QuoteSendModal } from "@/components/commercial/quote-send-modal";
import { ConventionModal } from "@/components/finance/convention-modal";
import { BillingPlanModal } from "@/components/finance/billing-plan-modal";

const TYPE_LABEL = { devis: "Devis", convention: "Convention", facture: "Facture" } as const;
const TYPE_COLOR = { devis: "#e8632b", convention: "#0b1f3a", facture: "#92600a" } as const;

export function PiecesAValiderView() {
  const [pieces, setPieces] = useState<PendingPiece[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PendingPiece | null>(null);
  const [acting, setActing] = useState(false);
  const [cacheBust, setCacheBust] = useState(Date.now());
  const [modal, setModal] = useState<PendingPiece | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/adv/pending");
      const json = await res.json();
      if (res.ok) {
        setPieces(json.pieces);
        setSelected((prev) => json.pieces.find((p: PendingPiece) => prev && p.type === prev.type && p.refId === prev.refId) ?? json.pieces[0] ?? null);
      } else { alert(json.error ?? "Erreur de chargement"); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function endpointBase(p: PendingPiece) {
    if (p.type === "devis") return `/api/deals/${p.dealId}/quote`;
    if (p.type === "convention") return `/api/deals/${p.dealId}/convention`;
    return `/api/billing-months/${p.refId}`;
  }

  async function act(p: PendingPiece, action: "validate" | "reject") {
    const verb = action === "validate" ? "valider et envoyer" : "rejeter";
    if (!confirm(`Confirmer : ${verb} ce ${TYPE_LABEL[p.type].toLowerCase()} ?`)) return;
    setActing(true);
    try {
      const res = await fetch(`${endpointBase(p)}/${action}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) { alert(`Échec : ${json.error ?? "erreur"}`); return; }
      alert(json.message ?? "OK");
      await load();
    } catch (e) {
      alert(`Erreur réseau : ${e instanceof Error ? e.message : String(e)}`);
    } finally { setActing(false); }
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Pièces à valider</h1>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
        Prévisualise chaque pièce puis valide (envoi au client), modifie ou rejette. Rien ne part sans validation.
      </p>

      {loading ? <p>Chargement…</p> : pieces.length === 0 ? (
        <p style={{ color: "#64748b" }}>Aucune pièce en attente de validation. 🎉</p>
      ) : (
        <div style={{ display: "flex", gap: 20 }}>
          {/* Liste */}
          <div style={{ width: 360, flexShrink: 0 }}>
            {pieces.map((p) => {
              const active = selected?.type === p.type && selected?.refId === p.refId;
              return (
                <button key={`${p.type}-${p.refId}`} onClick={() => setSelected(p)}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: 12, marginBottom: 8,
                    border: `1px solid ${active ? TYPE_COLOR[p.type] : "#e2e8f0"}`, borderRadius: 8,
                    background: active ? "#f8fafc" : "white", cursor: "pointer" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: TYPE_COLOR[p.type], textTransform: "uppercase" }}>{TYPE_LABEL[p.type]}</span>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{p.client ?? p.dealName ?? p.refId}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {p.amount != null ? `${p.amount.toLocaleString("fr-FR")} € HT` : ""}{p.dealName && p.client ? ` · ${p.dealName}` : ""}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Aperçu + actions */}
          <div style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, minHeight: 600 }}>
            {selected ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: TYPE_COLOR[selected.type], textTransform: "uppercase" }}>{TYPE_LABEL[selected.type]}</span>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{selected.client ?? selected.dealName ?? selected.refId}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => act(selected, "validate")} disabled={acting || (selected.type === "facture" && !selected.pdfReady)}
                      style={{ padding: "8px 16px", border: "none", borderRadius: 6, background: "#16a34a", color: "white", cursor: "pointer" }}>
                      {acting ? "…" : "Valider & envoyer"}
                    </button>
                    <button onClick={() => setModal(selected)} disabled={acting}
                      style={{ padding: "8px 16px", border: "1px solid #cbd5e1", borderRadius: 6, background: "white", cursor: "pointer" }}>Modifier</button>
                    <button onClick={() => act(selected, "reject")} disabled={acting}
                      style={{ padding: "8px 16px", border: "1px solid #ef4444", borderRadius: 6, background: "white", color: "#ef4444", cursor: "pointer" }}>Rejeter</button>
                    {selected.type === "devis" && selected.dealId && (
                      <>
                        <button
                          disabled={acting}
                          onClick={async () => {
                            const res = await fetch(`/api/deals/${selected.dealId}/quote/docx`);
                            const j = await res.json();
                            if (!res.ok) { alert(`Échec : ${j.error ?? "erreur"}`); return; }
                            window.open(j.url, "_blank");
                          }}
                          style={{ padding: "8px 16px", border: "1px solid #1a6b9c", borderRadius: 6, background: "white", color: "#1a6b9c", cursor: "pointer" }}
                        >
                          Télécharger le Word
                        </button>
                        <label style={{ padding: "8px 16px", border: "1px solid #8399a9", borderRadius: 6, background: "white", color: "#1a2a3a", cursor: acting ? "not-allowed" : "pointer", opacity: acting ? 0.5 : 1 }}>
                          Remplacer le Word
                          <input type="file" accept=".docx" style={{ display: "none" }} disabled={acting}
                            onChange={async (e) => {
                              const f = e.target.files?.[0]; if (!f || !selected?.dealId) return;
                              setActing(true);
                              const fd = new FormData(); fd.append("file", f);
                              const res = await fetch(`/api/deals/${selected.dealId}/quote/replace-docx`, { method: "POST", body: fd });
                              const j = await res.json();
                              if (!res.ok) alert(`Échec : ${j.error ?? "erreur"}`); else { alert(j.message); setCacheBust(Date.now()); load(); }
                              setActing(false); e.target.value = "";
                            }} />
                        </label>
                      </>
                    )}
                  </div>
                </div>
                {selected.pdfUrl ? (
                  <iframe
                    title="Aperçu PDF"
                    src={selected.type === "devis" && selected.dealId
                      ? `/api/deals/${selected.dealId}/quote/preview-pdf?t=${cacheBust}`
                      : selected.pdfUrl}
                    style={{ width: "100%", height: 560, border: "1px solid #e2e8f0", borderRadius: 6 }}
                  />
                ) : (
                  <p style={{ color: "#92600a" }}>📄 PDF en cours de génération (facture : 1-5 min après préparation). Recharge dans quelques minutes.</p>
                )}
              </>
            ) : <p style={{ color: "#64748b" }}>Sélectionne une pièce.</p>}
          </div>
        </div>
      )}

      {/* Modifier : réouvre la modale de création préremplie */}
      {modal?.type === "devis" && modal.dealId && (
        <QuoteSendModal dealId={modal.dealId} dealName={modal.dealName ?? ""} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />
      )}
      {modal?.type === "convention" && modal.dealId && (
        <ConventionModal dealId={modal.dealId} dealName={modal.dealName ?? ""} dealAmount={modal.amount}
          companyName={modal.client ?? ""} contactName="" trainingDays={modal.trainingDays}
          onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />
      )}
      {modal?.type === "facture" && (
        <BillingPlanModal dealId={modal.dealId ?? ""} dealName={modal.dealName ?? modal.client ?? ""}
          dealAmount={modal.amount} defaultClientName={modal.client ?? ""}
          onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />
      )}
    </div>
  );
}
