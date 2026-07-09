"use client";
import { Fragment, useMemo, useState } from "react";

export type EmailRow = {
  id: string;
  recipient: string;
  subject: string | null;
  body: string | null;
  transporter: string;
  status: string;
  error: string | null;
  has_attachments: boolean;
  attachment_count: number | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  source: string | null;
  created_at: string;
};

const STATUS_BADGE: Record<string, string> = {
  sent: "✅ Envoyé",
  failed: "❌ Échec",
};

// Un même email (notif interne, campagne) est loggé une ligne par destinataire, souvent éparpillé
// dans le temps. On regroupe par OBJET exact (toutes dates confondues) → une entrée dépliable par
// objet. Le serveur trie par date desc : le groupe se place à sa 1re apparition (= envoi le plus
// récent) et ses lignes restent triées desc. Un objet vide n'est jamais fusionné (envoi isolé).
type EmailGroup = { key: string; subject: string | null; anchor: EmailRow; rows: EmailRow[] };

function groupBySubject(rows: EmailRow[]): EmailGroup[] {
  const groups: EmailGroup[] = [];
  const bySubject = new Map<string, EmailGroup>();
  for (const r of rows) {
    const subj = (r.subject ?? "").trim();
    if (!subj) {
      groups.push({ key: r.id, subject: r.subject, anchor: r, rows: [r] });
      continue;
    }
    const existing = bySubject.get(subj);
    if (existing) {
      existing.rows.push(r);
    } else {
      const g: EmailGroup = { key: `subj:${subj}`, subject: r.subject, anchor: r, rows: [r] };
      bySubject.set(subj, g);
      groups.push(g);
    }
  }
  return groups;
}

function groupStatus(rows: EmailRow[]): string {
  const failed = rows.filter((r) => r.status === "failed").length;
  if (failed === 0) return STATUS_BADGE.sent;
  if (failed === rows.length) return STATUS_BADGE.failed;
  return `⚠️ ${failed} échec(s)`;
}

const uniq = (arr: string[]) => Array.from(new Set(arr));

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function toCsv(rows: EmailRow[]): string {
  const headers = ["Date", "Destinataire", "Objet", "Transporteur", "Statut", "Erreur", "PJ", "Lié à", "Source"];
  // Anti CSV-formula-injection : neutralise les cellules commençant par = + - @ (Excel/Sheets),
  // puis double-quote. Important pour un export « preuve Qualiopi » opposable.
  const esc = (v: string) => {
    const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const lines = rows.map((r) =>
    [
      fmtDate(r.created_at),
      r.recipient,
      r.subject ?? "",
      r.transporter,
      r.status,
      r.error ?? "",
      r.has_attachments ? "oui" : "non",
      r.related_entity_type ? `${r.related_entity_type}:${r.related_entity_id ?? ""}` : "",
      r.source ?? "",
    ].map((c) => esc(String(c))).join(","),
  );
  return [headers.map(esc).join(","), ...lines].join("\n");
}

export function EmailsClient({ initial }: { initial: EmailRow[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<EmailRow | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initial.filter((r) =>
      (!status || r.status === status) &&
      (!q ||
        r.recipient.toLowerCase().includes(q) ||
        (r.subject ?? "").toLowerCase().includes(q) ||
        (r.source ?? "").toLowerCase().includes(q)),
    );
  }, [initial, search, status]);

  const groups = useMemo(() => groupBySubject(filtered), [filtered]);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function exportCsv() {
    // Export à plat (une ligne par destinataire) : la preuve Qualiopi reste par email envoyé.
    const csv = toCsv(filtered);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `journal-emails-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Journal des emails</h1>
          <p className="text-sm text-muted-foreground">
            Preuve d&apos;envoi (Qualiopi) — {filtered.length} email(s) sur {initial.length} · {groups.length} objet(s).
          </p>
        </div>
        <button onClick={exportCsv} className="bg-primary text-primary-foreground rounded px-3 py-1.5 text-sm">
          Exporter CSV
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (destinataire, objet, source)…"
          className="border rounded px-3 py-1.5 text-sm flex-1 min-w-64"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          <option value="">Tous statuts</option>
          <option value="sent">Envoyés</option>
          <option value="failed">Échecs</option>
        </select>
      </div>

      <div className="border rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-2">Date</th>
              <th className="p-2">Destinataire</th>
              <th className="p-2">Objet</th>
              <th className="p-2">Transp.</th>
              <th className="p-2">Statut</th>
              <th className="p-2">PJ</th>
              <th className="p-2">Source</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const isGroup = g.rows.length > 1;
              const isOpen = expanded.has(g.key);
              const transps = uniq(g.rows.map((r) => r.transporter));
              const sources = uniq(g.rows.map((r) => r.source ?? "").filter(Boolean));
              const anyPj = g.rows.some((r) => r.has_attachments);
              return (
                <Fragment key={g.key}>
                  <tr
                    onClick={() => (isGroup ? toggle(g.key) : setSelected(g.anchor))}
                    aria-expanded={isGroup ? isOpen : undefined}
                    className="border-t align-top cursor-pointer hover:bg-muted/50"
                  >
                    <td className="p-2 whitespace-nowrap text-muted-foreground">{fmtDate(g.anchor.created_at)}</td>
                    <td className="p-2">
                      {isGroup ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="text-muted-foreground">{isOpen ? "▼" : "▶"}</span>
                          <span>{g.rows.length} destinataires</span>
                        </span>
                      ) : (
                        <span className="break-all">{g.anchor.recipient}</span>
                      )}
                    </td>
                    <td className="p-2">
                      {g.subject ?? <span className="text-muted-foreground">—</span>}
                      {!isGroup && g.anchor.status === "failed" && g.anchor.error ? (
                        <div className="text-xs text-red-600">{g.anchor.error}</div>
                      ) : null}
                    </td>
                    <td className="p-2 whitespace-nowrap">{transps.length === 1 ? transps[0] : "divers"}</td>
                    <td className="p-2 whitespace-nowrap">{isGroup ? groupStatus(g.rows) : STATUS_BADGE[g.anchor.status] ?? g.anchor.status}</td>
                    <td className="p-2">{anyPj ? "📎" : ""}</td>
                    <td className="p-2 text-xs text-muted-foreground">{sources.length === 1 ? sources[0] : sources.length > 1 ? "divers" : ""}</td>
                  </tr>

                  {isGroup && isOpen && g.rows.map((r) => (
                    <tr
                      key={r.id}
                      onClick={(e) => { e.stopPropagation(); setSelected(r); }}
                      className="border-t align-top cursor-pointer bg-muted/20 hover:bg-muted/50"
                    >
                      <td className="p-2 whitespace-nowrap text-xs text-muted-foreground">{fmtDate(r.created_at)}</td>
                      <td className="p-2 pl-8 break-all">{r.recipient}</td>
                      <td className="p-2 text-xs text-red-600">{r.status === "failed" && r.error ? r.error : ""}</td>
                      <td className="p-2 whitespace-nowrap text-muted-foreground">{r.transporter}</td>
                      <td className="p-2 whitespace-nowrap">{STATUS_BADGE[r.status] ?? r.status}</td>
                      <td className="p-2">{r.has_attachments ? "📎" : ""}</td>
                      <td className="p-2" />
                    </tr>
                  ))}
                </Fragment>
              );
            })}
            {groups.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Aucun email.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div
          onClick={() => setSelected(null)}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-lg bg-background shadow-lg">
            <div className="flex items-start justify-between gap-4 border-b p-4">
              <div className="min-w-0">
                <h2 className="truncate font-semibold">{selected.subject ?? "(sans objet)"}</h2>
                <p className="text-xs text-muted-foreground">{fmtDate(selected.created_at)}</p>
              </div>
              <button onClick={() => setSelected(null)} aria-label="Fermer" className="rounded px-2 py-1 text-muted-foreground hover:bg-muted">✕</button>
            </div>

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 p-4 text-sm">
              <dt className="text-muted-foreground">Destinataire</dt><dd className="break-all">{selected.recipient}</dd>
              <dt className="text-muted-foreground">Transporteur</dt><dd>{selected.transporter}</dd>
              <dt className="text-muted-foreground">Statut</dt><dd>{STATUS_BADGE[selected.status] ?? selected.status}</dd>
              <dt className="text-muted-foreground">Pièces jointes</dt><dd>{selected.has_attachments ? `📎 ${selected.attachment_count ?? ""}`.trim() : "—"}</dd>
              {selected.source && (<><dt className="text-muted-foreground">Source</dt><dd>{selected.source}</dd></>)}
              {selected.related_entity_type && (<><dt className="text-muted-foreground">Lié à</dt><dd className="break-all">{selected.related_entity_type}:{selected.related_entity_id ?? ""}</dd></>)}
            </dl>

            {selected.status === "failed" && selected.error && (
              <div className="mx-4 mb-4 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">{selected.error}</div>
            )}

            <div className="border-t p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Contenu</p>
              {selected.body ? (
                // Aperçu isolé : iframe sandbox="" (aucun script/formulaire/navigation) — le corps peut
                // être du HTML d'email ; on ne l'injecte JAMAIS dans le DOM parent (OWASP A03).
                <iframe sandbox="" srcDoc={selected.body} title="Aperçu de l'email" className="h-96 w-full rounded border bg-white" />
              ) : (
                <p className="text-sm text-muted-foreground">Corps non enregistré pour cet envoi.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
