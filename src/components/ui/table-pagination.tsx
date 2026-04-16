"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface TablePaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function TablePagination({ currentPage, totalItems, pageSize, onPageChange }: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems <= pageSize) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  // Show at most 5 page buttons around the current page
  const pages: number[] = [];
  const lo = Math.max(1, currentPage - 2);
  const hi = Math.min(totalPages, lo + 4);
  for (let i = Math.max(1, hi - 4); i <= hi; i++) pages.push(i);

  const btn = (disabled: boolean, onClick: () => void, children: React.ReactNode, key?: string) => (
    <button
      key={key}
      disabled={disabled}
      onClick={onClick}
      style={{
        height: 32, minWidth: 32, padding: "0 8px",
        borderRadius: 6, border: "1px solid #dce8f0",
        background: disabled ? "#f5f8fa" : "white",
        color: disabled ? "#b0bec5" : "#1a2a3a",
        cursor: disabled ? "default" : "pointer",
        fontSize: 13, fontWeight: 500,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {children}
    </button>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", fontSize: 13, color: "#5a6f80" }}>
      <span>{start}–{end} sur {totalItems}</span>
      <div style={{ display: "flex", gap: 4 }}>
        {btn(currentPage === 1, () => onPageChange(1), <ChevronsLeft className="h-4 w-4" />)}
        {btn(currentPage === 1, () => onPageChange(currentPage - 1), <ChevronLeft className="h-4 w-4" />)}
        {pages.map(p => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            style={{
              height: 32, minWidth: 32, padding: "0 8px",
              borderRadius: 6, border: p === currentPage ? "1px solid #0d4f7a" : "1px solid #dce8f0",
              background: p === currentPage ? "#0d4f7a" : "white",
              color: p === currentPage ? "white" : "#1a2a3a",
              cursor: "pointer", fontSize: 13, fontWeight: p === currentPage ? 700 : 500,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {p}
          </button>
        ))}
        {btn(currentPage === totalPages, () => onPageChange(currentPage + 1), <ChevronRight className="h-4 w-4" />)}
        {btn(currentPage === totalPages, () => onPageChange(totalPages), <ChevronsRight className="h-4 w-4" />)}
      </div>
    </div>
  );
}
