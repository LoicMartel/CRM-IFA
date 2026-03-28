"use client";

import { useState, useRef, useEffect } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type ExportFormat } from "@/lib/export";

export function ExportButton({ onExport }: { onExport: (format: ExportFormat) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
        <Download className="h-4 w-4 mr-2" />
        Exporter
      </Button>
      {open && (
        <div
          style={{
            position: "absolute", top: "100%", right: 0, marginTop: 4, zIndex: 50,
            background: "white", border: "1px solid #dce8f0", borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)", minWidth: 120,
          }}
        >
          {(["csv", "xls", "xlsx"] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => { onExport(fmt); setOpen(false); }}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "8px 14px", fontSize: 13, color: "#1a2a3a",
                border: "none", background: "transparent", cursor: "pointer",
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.background = "#f0f6fa"; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "transparent"; }}
            >
              {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
