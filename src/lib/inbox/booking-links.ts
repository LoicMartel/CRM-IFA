// Pages de booking internes du CRM (codées par Loïc, round-robin Google Calendar). Pas de Calendly.
const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://crm-lca.vercel.app";

export const BOOKING_LINKS = {
  general: `${BASE}/booking`,            // découverte générale (Rafi→Naznine) — défaut
  commercial: `${BASE}/booking-general`, // bilan commercial (Alexandre→Loïc→Rafi)
} as const;

export const DEFAULT_BOOKING_LINK = BOOKING_LINKS.general;

// V1: toujours la page découverte générale. Le mapping fin (par intent/persona) est backlog V2.
export function resolveBookingLink(): string {
  return DEFAULT_BOOKING_LINK;
}
