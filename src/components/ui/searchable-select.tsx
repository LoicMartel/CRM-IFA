"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
}

interface BaseProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Label to display for the currently selected value (needed for async mode) */
  selectedLabel?: string;
}

interface SyncProps extends BaseProps {
  options: Option[];
  fetchOptions?: never;
}

interface AsyncProps extends BaseProps {
  options?: never;
  /** Fetch options from server given a search query */
  fetchOptions: (query: string) => Promise<Option[]>;
}

type SearchableSelectProps = SyncProps | AsyncProps;

export function SearchableSelect({ options, value, onChange, placeholder = "Sélectionner", className, selectedLabel: selectedLabelProp, fetchOptions }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [asyncResults, setAsyncResults] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const isAsync = !!fetchOptions;

  const displayLabel = selectedLabelProp ?? options?.find((o) => o.value === value)?.label ?? "";

  const filtered = isAsync
    ? asyncResults
    : search
      ? (options ?? []).filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
      : (options ?? []);

  const doFetch = useCallback(async (q: string) => {
    if (!fetchOptions) return;
    setLoading(true);
    try {
      const results = await fetchOptions(q);
      setAsyncResults(results);
    } finally {
      setLoading(false);
    }
  }, [fetchOptions]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSearchChange(q: string) {
    setSearch(q);
    if (isAsync) {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doFetch(q), 250);
    }
  }

  function handleOpen() {
    setOpen(!open);
    setSearch("");
    if (!open && isAsync) {
      doFetch("");
    }
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        className="flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-1 text-sm text-left"
        onClick={handleOpen}
      >
        <span className={cn("flex-1 truncate", !value && "text-muted-foreground")}>
          {displayLabel || placeholder}
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
              onChange={(e) => handleSearchChange(e.target.value)}
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
            {loading ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">Chargement...</div>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
