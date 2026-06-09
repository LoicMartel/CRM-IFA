"use client";
import { useMemo, useState } from "react";

export type Row = {
  id: string;
  name: string;
  suggested: string | null;
  actual: string | null;
  correct: boolean | null;
  feedback: string | null;
};

function correctLabel(c: boolean | null): string {
  return c === true ? "✅ Oui" : c === false ? "❌ Non" : "—";
}

function toCsv(rows: Row[]): string {
  const headers = ["Deal", "Formateur suggéré (IA)", "Formateur réel", "Suggestion correcte", "Note"];
  // Anti CSV-formula-injection (Excel/Sheets) + double-quote.
  const esc = (v: string) => {
    const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const lines = rows.map((r) =>
    [r.name, r.suggested ?? "", r.actual ?? "", r.correct === true ? "oui" : r.correct === false ? "non" : "", r.feedback ?? ""]
      .map((c) => esc(String(c))).join(","),
  );
  return [headers.map(esc).join(","), ...lines].join("\n");
}

export function TrainerReportClient({ rows }: { rows: Row[] }) {
  const [filter, setFilter] = useState<"" | "correct" | "incorrect">("");

  const filtered = useMemo(
    () => rows.filter((r) =>
      !filter || (filter === "correct" ? r.correct === true : r.correct === false)),
    [rows, filter],
  );

  const rated = rows.filter((r) => r.correct !== null);
  const correctCount = rated.filter((r) => r.correct === true).length;
  const matchRate = rated.length ? Math.round((correctCount / rated.length) * 100) : null;

  function exportCsv() {
    const blob = new Blob(["﻿" + toCsv(filtered)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-formateurs-wf009-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Rapport formateurs (WF-009)</h1>
          <p className="text-sm text-muted-foreground">
            Suggestion IA vs réalité — {rated.length} deal(s) évalué(s){matchRate !== null ? ` · taux de match ${matchRate}% (${correctCount}/${rated.length})` : ""}.
            {rated.length < 30 ? " Objectif : 30-40 deals avant itération utile." : ""}
          </p>
        </div>
        <button onClick={exportCsv} className="bg-primary text-primary-foreground rounded px-3 py-1.5 text-sm">
          Exporter CSV
        </button>
      </div>

      <div className="flex gap-2">
        <select value={filter} onChange={(e) => setFilter(e.target.value as "" | "correct" | "incorrect")} className="border rounded px-2 py-1.5 text-sm">
          <option value="">Tous</option>
          <option value="correct">Suggestions correctes</option>
          <option value="incorrect">Suggestions incorrectes</option>
        </select>
      </div>

      <div className="border rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-2">Deal</th>
              <th className="p-2">Formateur suggéré (IA)</th>
              <th className="p-2">Formateur réel</th>
              <th className="p-2">Correcte ?</th>
              <th className="p-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="p-2">{r.name}</td>
                <td className="p-2">{r.suggested ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="p-2">{r.actual ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="p-2 whitespace-nowrap">{correctLabel(r.correct)}</td>
                <td className="p-2 text-xs text-muted-foreground">{r.feedback ?? ""}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Aucun retour collector pour l&apos;instant.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
