"use client";
import { useMemo, useState } from "react";

export type EmailRow = {
  id: string;
  recipient: string;
  subject: string | null;
  transporter: string;
  status: string;
  error: string | null;
  has_attachments: boolean;
  related_entity_type: string | null;
  related_entity_id: string | null;
  source: string | null;
  created_at: string;
};

const STATUS_BADGE: Record<string, string> = {
  sent: "✅ Envoyé",
  failed: "❌ Échec",
};

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

  function exportCsv() {
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
          <p className="text-sm text-muted-foreground">Preuve d&apos;envoi (Qualiopi) — {filtered.length} email(s) affiché(s) sur {initial.length}.</p>
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
            {filtered.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="p-2 whitespace-nowrap text-muted-foreground">{fmtDate(r.created_at)}</td>
                <td className="p-2">{r.recipient}</td>
                <td className="p-2">
                  {r.subject ?? <span className="text-muted-foreground">—</span>}
                  {r.status === "failed" && r.error ? <div className="text-xs text-red-600">{r.error}</div> : null}
                </td>
                <td className="p-2 whitespace-nowrap">{r.transporter}</td>
                <td className="p-2 whitespace-nowrap">{STATUS_BADGE[r.status] ?? r.status}</td>
                <td className="p-2">{r.has_attachments ? "📎" : ""}</td>
                <td className="p-2 text-xs text-muted-foreground">{r.source ?? ""}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Aucun email.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
