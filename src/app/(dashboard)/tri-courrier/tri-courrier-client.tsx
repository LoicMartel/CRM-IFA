"use client";
import { useEffect, useState, useCallback } from "react";
import { FOLDER_BADGE, TRIAGE_FOLDERS, ASSIGNEES, type TriageFolderSlug } from "@/lib/inbox/triage-config";

export type TriConv = {
  id: string; channel: string; subject: string | null; last_message_at: string; unread: boolean;
  triage_folder: string | null; triage_action_required: boolean | null;
  triage_assignee: string | null; triage_folder_reason: string | null;
  contacts: { first_name: string | null; last_name: string | null; email: string | null } | null;
};
type Msg = { id: string; sent_by: string; body: string; created_at: string };
type Detail = { conversation: TriConv; messages: Msg[] };

const CHANNEL_LABEL: Record<string, string> = {
  linkedin: "LinkedIn", email: "Email", whatsapp: "WhatsApp", instagram: "Instagram",
  messenger: "Messenger", sms: "SMS", web_form: "Formulaire",
};

function FolderBadge({ slug }: { slug: string | null }) {
  if (!slug) return <span className="text-xs text-muted-foreground">— non classé</span>;
  const b = FOLDER_BADGE[slug as TriageFolderSlug];
  return <span className="text-xs">{b ? `${b.emoji} ${b.label}` : slug}</span>;
}

function contactName(c: TriConv["contacts"]): string {
  if (!c) return "Inconnu";
  return `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "Inconnu";
}

export function TriCourrierClient({ initial }: { initial: TriConv[] }) {
  const [convs, setConvs] = useState<TriConv[]>(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [folder, setFolder] = useState("");
  const [assignee, setAssignee] = useState("");
  const [actionOnly, setActionOnly] = useState(false);

  // Rafraîchissement auto (~25s), comme l'inbox leads. Le filtrage (dossier/destinataire/à traiter)
  // reste CLIENT-SIDE : on re-fetch toujours toute la liste classify et on filtre en mémoire.
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/triage");
      if (!r.ok) return;
      const j = await r.json();
      const rows = (j.conversations ?? []) as Array<Omit<TriConv, "contacts"> & { contacts: TriConv["contacts"] | TriConv["contacts"][] }>;
      setConvs(rows.map((c) => ({ ...c, contacts: Array.isArray(c.contacts) ? (c.contacts[0] ?? null) : c.contacts })));
    } catch {
      // erreur réseau transitoire → on garde la liste courante
    }
  }, []);

  useEffect(() => {
    const t = setInterval(refresh, 25_000);
    return () => clearInterval(t);
  }, [refresh]);

  const filtered = convs.filter((c) =>
    (!folder || c.triage_folder === folder) &&
    (!assignee || c.triage_assignee === assignee) &&
    (!actionOnly || c.triage_action_required === true)
  );

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <aside className="w-96 border-r overflow-y-auto">
        <div className="p-3 flex flex-wrap gap-2 border-b items-center">
          <select value={folder} onChange={(e) => setFolder(e.target.value)} className="border rounded px-2 py-1 text-sm">
            <option value="">Tous dossiers</option>
            {TRIAGE_FOLDERS.map((f) => <option key={f.slug} value={f.slug}>{f.emoji} {f.label}</option>)}
          </select>
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="border rounded px-2 py-1 text-sm" title="Filtrer par destinataire">
            <option value="">Tous destinataires</option>
            {ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <label className="text-sm flex items-center gap-1">
            <input type="checkbox" checked={actionOnly} onChange={(e) => setActionOnly(e.target.checked)} /> À traiter
          </label>
        </div>
        {filtered.map((c) => (
          <button key={c.id} onClick={() => setSelected(c.id)}
            className={`w-full text-left p-3 border-b hover:bg-muted ${c.unread ? "font-semibold" : ""} ${selected === c.id ? "bg-muted" : ""}`}>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{CHANNEL_LABEL[c.channel] ?? c.channel}</span>
              <span className="flex items-center gap-1">
                {c.triage_action_required ? <span title="À traiter">🔵</span> : null}
                {c.triage_assignee ? <span className="rounded bg-muted px-1">{c.triage_assignee}</span> : null}
              </span>
            </div>
            <div>{contactName(c.contacts)}</div>
            <div className="text-xs"><FolderBadge slug={c.triage_folder} /></div>
            <div className="text-xs text-muted-foreground truncate">{c.subject ?? ""}</div>
          </button>
        ))}
        {filtered.length === 0 && <p className="p-4 text-sm text-muted-foreground">Aucun courrier à trier.</p>}
      </aside>
      <main className="flex-1 overflow-y-auto">
        {selected ? <ReadOnlyThread id={selected} onRelabel={refresh} /> : <p className="p-8 text-muted-foreground">Sélectionne un courrier.</p>}
      </main>
    </div>
  );
}

// Lecture seule — NET-NEW (fork du Thread d'inbox sans textarea/brouillon/envoi). Aucune route reply
// n'est appelée ici : sur la boîte de Rafi on ne répond jamais, on classe.
function ReadOnlyThread({ id, onRelabel }: { id: string; onRelabel: () => void }) {
  const [data, setData] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/triage/${id}`);
    setData(await r.json());
  }, [id]);

  useEffect(() => {
    let active = true;
    (async () => {
      const r = await fetch(`/api/triage/${id}`);
      const j = await r.json();
      if (active) setData(j);
    })();
    return () => { active = false; };
  }, [id]);

  async function relabel(patch: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/triage/${id}/relabel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    await load();
    setBusy(false);
    onRelabel();
  }

  if (!data) return <p className="p-6 text-muted-foreground">Chargement…</p>;
  const c = data.conversation;
  const SENDER_STYLE: Record<string, string> = {
    lead: "bg-muted", agent: "bg-blue-100 ml-auto", human: "bg-primary text-primary-foreground ml-auto",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <FolderBadge slug={c.triage_folder} />
          {c.triage_action_required ? <span className="text-xs rounded bg-blue-100 px-1">à traiter</span> : null}
        </div>
        {c.triage_folder_reason && <p className="text-xs text-muted-foreground">{c.triage_folder_reason}</p>}
        <div className="flex flex-wrap gap-2 items-center">
          <select disabled={busy} value={c.triage_folder ?? ""} onChange={(e) => relabel({ triage_folder: e.target.value })} className="border rounded px-2 py-1 text-xs" title="Reclasser dans un dossier">
            <option value="" disabled>Reclasser…</option>
            {TRIAGE_FOLDERS.map((f) => <option key={f.slug} value={f.slug}>{f.emoji} {f.label}</option>)}
          </select>
          <select disabled={busy} value={c.triage_assignee ?? ""} onChange={(e) => relabel({ triage_assignee: e.target.value || null })} className="border rounded px-2 py-1 text-xs" title="Réaffecter le destinataire">
            <option value="">— destinataire —</option>
            {ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <label className="text-xs flex items-center gap-1">
            <input type="checkbox" disabled={busy} checked={!!c.triage_action_required} onChange={(e) => relabel({ triage_action_required: e.target.checked })} /> à traiter
          </label>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {data.messages.map((m) => (
          <div key={m.id} className={`max-w-[70%] rounded p-2 text-sm ${SENDER_STYLE[m.sent_by] ?? "bg-muted"}`}>{m.body}</div>
        ))}
      </div>
      <div className="border-t p-3 text-xs text-muted-foreground">
        Lecture seule — aucune réponse n&apos;est envoyée depuis cette boîte (tri uniquement).
      </div>
    </div>
  );
}
