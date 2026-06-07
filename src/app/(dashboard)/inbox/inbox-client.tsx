"use client";
import { useEffect, useState, useCallback } from "react";

export type Conv = {
  id: string; channel: string; category: string | null; intent: string | null;
  agent_status: string; escalation_reason: string | null; unread: boolean;
  subject: string | null; last_message_at: string;
  contacts: { first_name: string | null; last_name: string | null; email: string | null } | null;
};
type Msg = { id: string; sent_by: string; body: string; created_at: string };

const CHANNEL_LABEL: Record<string, string> = {
  linkedin: "LinkedIn", email: "Email", whatsapp: "WhatsApp", instagram: "Instagram",
  messenger: "Messenger", sms: "SMS", web_form: "Formulaire",
};
const STATUS_BADGE: Record<string, string> = {
  active: "🤖 Agent", escalated: "⚠️ À reprendre", booked: "✅ RDV pris", dormant: "💤 Dormant", human: "🙋 Manuel",
};

export function InboxClient({ initial }: { initial: Conv[] }) {
  const [convs, setConvs] = useState<Conv[]>(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [channel, setChannel] = useState("");
  const [attention, setAttention] = useState(true); // filtre par défaut

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
    (!attention || (["escalated", "human"].includes(c.agent_status) && c.unread))
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
        </div>
        {filtered.map((c) => (
          <button key={c.id} onClick={() => setSelected(c.id)}
            className={`w-full text-left p-3 border-b hover:bg-muted ${c.unread ? "font-semibold" : ""} ${selected === c.id ? "bg-muted" : ""}`}>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{CHANNEL_LABEL[c.channel] ?? c.channel}</span>
              <span>{STATUS_BADGE[c.agent_status] ?? c.agent_status}</span>
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
  const [data, setData] = useState<{ conversation: Conv; messages: Msg[] } | null>(null);
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
  const replyable = ["email", "whatsapp", "instagram", "messenger"].includes(c.channel);
  const SENDER_STYLE: Record<string, string> = {
    lead: "bg-muted", agent: "bg-blue-100 ml-auto", human: "bg-primary text-primary-foreground ml-auto",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-3 flex items-center justify-between">
        <span className="text-sm">{STATUS_BADGE[c.agent_status] ?? c.agent_status}{c.escalation_reason ? ` · ${c.escalation_reason}` : ""}</span>
        {c.agent_status === "active" && <button onClick={takeover} disabled={busy} className="border rounded px-3 py-1 text-sm">Reprendre la main</button>}
      </div>
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
