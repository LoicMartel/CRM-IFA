"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

/** Entité (raison sociale) proposée au choix, ou repli sur l'entreprise (id vide). */
type Entity = {
  id: string;
  name: string | null;
  siret: string | null;
  address: string | null;
  learner_names: string[];
};

export function ConventionModal({
  dealId, dealName, dealAmount, companyName, contactName, trainingDays, onClose, onDone,
}: {
  dealId: string;
  dealName: string;
  dealAmount: number | null;
  companyName: string;
  contactName: string;
  trainingDays: number | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const today = new Date().toLocaleDateString("fr-FR");
  const [intitule, setIntitule] = useState(dealName);
  const [dureeHeures, setDureeHeures] = useState(trainingDays ? String(trainingDays * 7) : "");
  const [lieu, setLieu] = useState("Présentiel");
  const [effectifs, setEffectifs] = useState("");
  const [horaires, setHoraires] = useState("");
  const [dateSession, setDateSession] = useState("");
  const [formateur, setFormateur] = useState("");
  const [programme, setProgramme] = useState("");
  const [stagiaires, setStagiaires] = useState<string[]>([""]);
  const [dateSignature, setDateSignature] = useState(today);
  const [lieuSignature, setLieuSignature] = useState("Combaillaux");
  const [saving, setSaving] = useState(false);

  const [entities, setEntities] = useState<Entity[]>([]);
  const [companyEntity, setCompanyEntity] = useState<Entity | null>(null);
  const [raisonSocialeId, setRaisonSocialeId] = useState("");

  const ht = dealAmount ?? 0;

  /** Les stagiaires et l'effectif suivent l'entité : ce sont ses apprenants rattachés. */
  function prefillFrom(names: string[]) {
    setStagiaires(names.length > 0 ? names : [""]);
    setEffectifs(names.length > 0 ? String(names.length) : "");
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await fetch(`/api/deals/${dealId}/raisons-sociales`);
      const json = await res.json();
      if (!active || !res.ok) return;
      const options: Entity[] = json.raisons_sociales ?? [];
      const fallback: Entity | null = json.company ? { id: "", ...json.company } : null;
      setEntities(options);
      setCompanyEntity(fallback);
      const initial = options.some((o) => o.id === json.selected_id) ? json.selected_id : "";
      setRaisonSocialeId(initial);
      prefillFrom((initial ? options.find((o) => o.id === initial) : fallback)?.learner_names ?? []);
    })();
    return () => { active = false; };
  }, [dealId]);

  function selectEntity(id: string) {
    setRaisonSocialeId(id);
    prefillFrom((id ? entities.find((o) => o.id === id) : companyEntity)?.learner_names ?? []);
  }

  const selected = raisonSocialeId ? entities.find((o) => o.id === raisonSocialeId) : companyEntity;

  async function submit() {
    if (!intitule.trim()) { alert("Intitulé requis"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/deals/${dealId}/convention`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intitule, dureeHeures, lieu, effectifs, horaires, dateSession,
          formateur, programme, stagiaires, dateSignature, lieuSignature,
          raisonSocialeId: raisonSocialeId || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { alert(`Échec : ${json.error ?? "erreur"}`); return; }
      alert("Convention préparée — à valider avant envoi.");
      onDone();
    } catch (e) {
      alert(`Erreur réseau : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  const field = { width: "100%", padding: 8, border: "1px solid #cbd5e1", borderRadius: 6, marginBottom: 10 } as const;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: "white", borderRadius: 8, padding: 24, width: 560, maxHeight: "88vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>Gérer la convention</h2>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>{dealName}</p>
        <p style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
          {companyName} · {contactName} · {ht.toLocaleString("fr-FR")} € HT (TVA 20 % → {(ht * 1.2).toLocaleString("fr-FR")} € TTC)
        </p>

        {entities.length > 0 && (
          <>
            <label style={{ fontSize: 13 }}>Raison sociale (bénéficiaire)</label>
            <select value={raisonSocialeId} onChange={(e) => selectEntity(e.target.value)} style={field}>
              <option value="">{companyEntity?.name ?? companyName} — infos de l&apos;entreprise</option>
              {entities.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </>
        )}
        {selected && (
          <p style={{ fontSize: 12, color: selected.siret ? "#64748b" : "#92600a", marginBottom: 12 }}>
            Sur la convention : {selected.name ?? "—"} · SIRET {selected.siret || "manquant"} · {selected.address || "adresse manquante"}
          </p>
        )}

        <label style={{ fontSize: 13 }}>Intitulé de la formation</label>
        <input value={intitule} onChange={(e) => setIntitule(e.target.value)} style={field} />

        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 13 }}>Durée (heures)</label>
            <input value={dureeHeures} onChange={(e) => setDureeHeures(e.target.value)} style={field} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 13 }}>Effectifs</label>
            <input value={effectifs} onChange={(e) => setEffectifs(e.target.value)} style={field} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 13 }}>Lieu</label>
            <select value={lieu} onChange={(e) => setLieu(e.target.value)} style={field}>
              <option>Présentiel</option><option>Distanciel</option><option>e-learning</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 13 }}>Horaires</label>
            <input value={horaires} onChange={(e) => setHoraires(e.target.value)} placeholder="9H à 17H" style={field} />
          </div>
        </div>

        <label style={{ fontSize: 13 }}>Date(s) de session</label>
        <input value={dateSession} onChange={(e) => setDateSession(e.target.value)} placeholder="15/06/2026" style={field} />

        <label style={{ fontSize: 13 }}>Formateur</label>
        <input value={formateur} onChange={(e) => setFormateur(e.target.value)} style={field} />

        <label style={{ fontSize: 13 }}>Programme / objectifs (annexe)</label>
        <textarea value={programme} onChange={(e) => setProgramme(e.target.value)} rows={4} style={field} />

        <label style={{ fontSize: 13 }}>Stagiaires</label>
        {stagiaires.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input value={s} onChange={(e) => setStagiaires((p) => p.map((x, idx) => idx === i ? e.target.value : x))} placeholder="NOM Prénom" style={{ ...field, marginBottom: 0, flex: 1 }} />
            <button onClick={() => setStagiaires((p) => p.filter((_, idx) => idx !== i))} disabled={stagiaires.length === 1} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 style={{ width: 16, height: 16, color: "#ef4444" }} /></button>
          </div>
        ))}
        <button onClick={() => setStagiaires((p) => [...p, ""])} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "1px dashed #cbd5e1", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 13, marginBottom: 12 }}>
          <Plus style={{ width: 14, height: 14 }} /> stagiaire
        </button>

        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 13 }}>Date signature</label>
            <input value={dateSignature} onChange={(e) => setDateSignature(e.target.value)} style={field} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 13 }}>Lieu signature</label>
            <input value={lieuSignature} onChange={(e) => setLieuSignature(e.target.value)} style={field} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: "8px 16px", border: "1px solid #cbd5e1", borderRadius: 6, background: "white", cursor: "pointer" }}>Annuler</button>
          <button onClick={submit} disabled={saving} style={{ padding: "8px 16px", border: "none", borderRadius: 6, background: "#e8632b", color: "white", cursor: "pointer" }}>
            {saving ? "..." : "Générer pour validation"}
          </button>
        </div>
      </div>
    </div>
  );
}
