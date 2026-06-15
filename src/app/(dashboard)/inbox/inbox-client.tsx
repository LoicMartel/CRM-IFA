"use client";
import { useEffect, useState, useCallback } from "react";

export type Conv = {
  id: string; channel: string; category: string | null; intent: string | null;
  agent_status: string; escalation_reason: string | null; unread: boolean;
  subject: string | null; last_message_at: string;
  // optionnels : absents des réponses API tant que la migration interest_score n'est pas appliquée
  interest_score?: number | null; score_reason?: string | null;
  contacts: { id?: string; first_name: string | null; last_name: string | null; email: string | null; phone?: string | null; source_id?: string | null } | null;
};
type Msg = { id: string; sent_by: string; body: string; created_at: string };
type ContactDetail = {
  created_at: string | null;
  lifecycle_stage: string | null;
  lead_status: string | null;
  company_name: string | null;
  owner_name: string | null;
  deals: Array<{ id: string; name: string | null; stage: string | null; amount: number | null }>;
};

// Libellés des statuts du cycle de vie (alignés sur la fiche contact). Le badge n'apparaît que si connu.
const LIFECYCLE_LABEL: Record<string, string> = {
  prospect: "Prospect", lead_marketing: "Lead Marketing", customer: "Client", former_customer: "Ancien client",
};

// Ancienneté du lead, format FR compact (réutilise la même logique que la cloche de notifications).
function timeAgo(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d}j`;
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

const CHANNEL_LABEL: Record<string, string> = {
  linkedin: "LinkedIn", email: "Email", whatsapp: "WhatsApp", instagram: "Instagram",
  messenger: "Messenger", sms: "SMS", web_form: "Formulaire",
};
const STATUS_BADGE: Record<string, string> = {
  active: "🤖 Agent", escalated: "⚠️ À reprendre", booked: "✅ RDV pris", dormant: "💤 Dormant", human: "🙋 Manuel",
};

// Badge de score d'intérêt (copilote F P1). Affiché seulement pour les conversations scorées
// (interest_score non null) ; les leads en mode agent ne sont pas scorés → pas de badge.
function scoreStyle(score: number): { bg: string; text: string; icon: string } {
  if (score >= 80) return { bg: "#ffebee", text: "#c62828", icon: "🔥" };
  if (score >= 60) return { bg: "#fff3e0", text: "#e65100", icon: "⭐" };
  if (score >= 40) return { bg: "#fffde7", text: "#f57f17", icon: "" };
  return { bg: "#f5f5f5", text: "#757575", icon: "" };
}
function ScoreBadge({ score, reason }: { score?: number | null; reason?: string | null }) {
  if (score == null) return null;
  const s = scoreStyle(score);
  return (
    <span title={reason ?? undefined}
      style={{ background: s.bg, color: s.text, borderRadius: 4, padding: "0 6px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
      {s.icon ? `${s.icon} ` : ""}{score}
    </span>
  );
}

export function InboxClient({ initial }: { initial: Conv[] }) {
  const [convs, setConvs] = useState<Conv[]>(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [channel, setChannel] = useState("");
  const [attention, setAttention] = useState(true); // filtre par défaut
  const [minScore, setMinScore] = useState(0); // filtre score copilote (0 = tous)

  // Rafraîchissement auto de la liste (~25s) : nouveaux messages / escalades remontent sans reload.
  // Le filtrage reste client-side (channel/attention) ; on re-fetch les 200 dernières conversations.
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const r = await fetch("/api/inbox");
        if (!r.ok) return;
        const j = await r.json();
        const rows = (j.conversations ?? []) as Array<Omit<Conv, "contacts"> & { contacts: Conv["contacts"] | Conv["contacts"][] }>;
        const next: Conv[] = rows.map((c) => ({
          ...c,
          contacts: Array.isArray(c.contacts) ? (c.contacts[0] ?? null) : c.contacts,
        }));
        if (active) setConvs(next);
      } catch {
        // erreur réseau transitoire → on garde la liste courante
      }
    };
    const interval = setInterval(refresh, 25_000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  const filtered = convs.filter((c) =>
    (!channel || c.channel === channel) &&
    (!attention || (["escalated", "human"].includes(c.agent_status) && c.unread)) &&
    (minScore === 0 || (c.interest_score != null && c.interest_score >= minScore))
  );

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <aside className="w-96 border-r overflow-y-auto">
        <div className="p-3 flex gap-2 border-b items-center">
          <label className="text-sm flex items-center gap-1">
            <input type="checkbox" checked={attention} onChange={(e) => setAttention(e.target.checked)} />
            Mon attention
          </label>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className="border rounded px-2 py-1 text-sm">
            <option value="">Tous canaux</option>
            {Object.entries(CHANNEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="border rounded px-2 py-1 text-sm" title="Filtrer par score d'intérêt (copilote)">
            <option value={0}>Tous scores</option>
            <option value={40}>Score ≥ 40</option>
            <option value={60}>Score ≥ 60</option>
            <option value={80}>Score ≥ 80</option>
          </select>
        </div>
        {filtered.map((c) => (
          <button key={c.id} onClick={() => setSelected(c.id)}
            className={`w-full text-left p-3 border-b hover:bg-muted ${c.unread ? "font-semibold" : ""} ${selected === c.id ? "bg-muted" : ""}`}>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{CHANNEL_LABEL[c.channel] ?? c.channel}</span>
              <span className="flex items-center gap-1">
                <ScoreBadge score={c.interest_score} reason={c.score_reason} />
                {STATUS_BADGE[c.agent_status] ?? c.agent_status}
              </span>
            </div>
            <div>{c.contacts ? `${c.contacts.first_name ?? ""} ${c.contacts.last_name ?? ""}`.trim() || c.contacts.email : "Inconnu"}</div>
            <div className="text-xs text-muted-foreground truncate">{c.subject ?? ""}</div>
          </button>
        ))}
        {filtered.length === 0 && <p className="p-4 text-sm text-muted-foreground">Aucune conversation.</p>}
      </aside>
      <main className="flex-1 overflow-y-auto">
        {selected ? <Thread id={selected} /> : <p className="p-8 text-muted-foreground">Sélectionne une conversation.</p>}
      </main>
    </div>
  );
}

function Thread({ id }: { id: string }) {
  const [data, setData] = useState<{ conversation: Conv; messages: Msg[]; source_label?: string | null; contact_detail?: ContactDetail | null } | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/inbox/${id}`);
    setData(await r.json());
  }, [id]);
  useEffect(() => {
    let active = true;
    (async () => {
      const r = await fetch(`/api/inbox/${id}`);
      const j = await r.json();
      if (active) setData(j);
    })();
    return () => { active = false; };
  }, [id]);

  async function takeover() { setBusy(true); await fetch(`/api/inbox/${id}/takeover`, { method: "POST" }); await load(); setBusy(false); }
  async function genDraft() {
    setBusy(true);
    const r = await fetch(`/api/inbox/${id}/draft`, { method: "POST" });
    const j = await r.json(); if (j.draft) setReply(j.draft);
    setBusy(false);
  }
  async function send() {
    setBusy(true);
    const r = await fetch(`/api/inbox/${id}/reply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: reply }) });
    if (!r.ok) alert("Envoi impossible: " + (await r.json()).error);
    setReply(""); await load(); setBusy(false);
  }

  if (!data) return <p className="p-6 text-muted-foreground">Chargement…</p>;
  const c = data.conversation;
  const d = data.contact_detail;
  const replyable = ["email", "whatsapp", "instagram", "messenger"].includes(c.channel);
  const SENDER_STYLE: Record<string, string> = {
    lead: "bg-muted", agent: "bg-blue-100 ml-auto", human: "bg-primary text-primary-foreground ml-auto",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-3 flex items-center justify-between">
        <span className="text-sm flex items-center gap-2">
          {STATUS_BADGE[c.agent_status] ?? c.agent_status}{c.escalation_reason ? ` · ${c.escalation_reason}` : ""}
          <ScoreBadge score={c.interest_score} reason={c.score_reason} />
        </span>
        {c.agent_status === "active" && <button onClick={takeover} disabled={busy} className="border rounded px-3 py-1 text-sm">Reprendre la main</button>}
      </div>
      {c.contacts && (
        <div className="border-b px-3 py-2 text-xs space-y-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-medium text-sm">
              {`${c.contacts.first_name ?? ""} ${c.contacts.last_name ?? ""}`.trim() || "Contact"}
            </span>
            {c.contacts.email && <a href={`mailto:${c.contacts.email}`} className="underline">✉ {c.contacts.email}</a>}
            {c.contacts.phone && <a href={`tel:${c.contacts.phone}`} className="text-muted-foreground">☎ {c.contacts.phone}</a>}
            {c.contacts.id && (
              <a href={`/contacts/${c.contacts.id}`} className="ml-auto border rounded px-2 py-0.5 hover:bg-muted whitespace-nowrap">
                Voir la fiche →
              </a>
            )}
          </div>
          {(d?.company_name || d?.owner_name || d?.lifecycle_stage || d?.created_at || data.source_label || d) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
              {d?.company_name && <span>🏢 {d.company_name}</span>}
              {d?.owner_name && <span>👤 Assigné : {d.owner_name}</span>}
              {d?.lifecycle_stage && LIFECYCLE_LABEL[d.lifecycle_stage] && (
                <span className="rounded px-1.5 py-0.5" style={{ background: "#eef2ff", color: "#3730a3" }}>
                  🏷 {LIFECYCLE_LABEL[d.lifecycle_stage]}
                </span>
              )}
              {timeAgo(d?.created_at ?? null) && <span>◷ Lead {timeAgo(d!.created_at)}</span>}
              {data.source_label && <span>📣 {data.source_label}</span>}
              {d && (
                <span>
                  💼 {d.deals.length} deal{d.deals.length > 1 ? "s" : ""} lié{d.deals.length > 1 ? "s" : ""}
                  {d.deals.length > 0 && d.deals[0].name ? ` · ${d.deals[0].name}` : ""}
                </span>
              )}
            </div>
          )}
        </div>
      )}
      {c.interest_score != null && c.score_reason && (
        <div className="border-b px-3 py-1.5 text-xs text-muted-foreground bg-muted/50">
          Score d&apos;intérêt {c.interest_score}/100 — {c.score_reason}
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {data.messages.map((m) => (
          <div key={m.id} className={`max-w-[70%] rounded p-2 text-sm ${SENDER_STYLE[m.sent_by] ?? "bg-muted"}`}>{m.body}</div>
        ))}
      </div>
      <div className="border-t p-3 space-y-2">
        {replyable ? (
          <>
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={4} className="w-full border rounded p-2 text-sm" placeholder="Réponse (relue avant envoi)…" />
            <div className="flex gap-2">
              <button onClick={genDraft} disabled={busy} className="border rounded px-3 py-1 text-sm">Brouillon IA</button>
              <button onClick={send} disabled={busy || !reply.trim()} className="bg-primary text-primary-foreground rounded px-3 py-1 text-sm">Valider &amp; envoyer</button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Canal {c.channel} : réponse depuis l&apos;app native (anti-ban).</p>
        )}
      </div>
    </div>
  );
}
