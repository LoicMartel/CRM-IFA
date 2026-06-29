"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchableSelect({ options, value, onChange, placeholder = "Sélectionner", className }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        className="flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-1 text-sm text-left"
        onClick={() => { setOpen(!open); setSearch(""); setTimeout(() => inputRef.current?.focus(), 0); }}
      >
        <span className={cn("flex-1 truncate", !value && "text-muted-foreground")}>
          {selectedLabel || placeholder}
        </span>
        <svg className="ml-2 h-4 w-4 shrink-0 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg dark:bg-neutral-900">
          <div className="p-1.5">
            <input
              ref={inputRef}
              className="w-full rounded border border-input bg-transparent px-2 py-1 text-sm outline-none focus:border-ring"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            <button
              type="button"
              className="w-full px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent"
              onClick={() => { onChange(""); setOpen(false); }}
            >
              {placeholder}
            </button>
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                className={cn(
                  "w-full px-3 py-1.5 text-left text-sm hover:bg-accent",
                  o.value === value && "bg-accent font-medium"
                )}
                onClick={() => { onChange(o.value); setOpen(false); setSearch(""); }}
              >
                {o.label}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">Aucun résultat</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
