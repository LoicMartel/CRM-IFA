import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a duration in hours (e.g. 0.5 → "30mn", 1 → "1h", 1.5 → "1h30") */
export function fmtDuration(hours: number | string | null | undefined): string {
  const h = Number(hours);
  if (!h && h !== 0) return "—";
  if (h < 1) return `${Math.round(h * 60)}mn`;
  const full = Math.floor(h);
  const mins = Math.round((h - full) * 60);
  return mins > 0 ? `${full}h${String(mins).padStart(2, "0")}` : `${full}h`;
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");
  // French format: 06 99 25 24 87
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4 $5");
  }
  // International +33 6 99 25 24 87
  if (digits.length === 11 && digits.startsWith("33")) {
    const local = "0" + digits.slice(2);
    return local.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4 $5");
  }
  // Fallback: group by 2
  return digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}
