// Pages de booking internes du CRM (codées par Loïc, round-robin Google Calendar). Pas de Calendly.
const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://crm-lca.vercel.app";

export const BOOKING_LINKS = {
  general: `${BASE}/booking`,            // découverte générale (Rafi→Naznine) — défaut
  commercial: `${BASE}/booking-general`, // bilan commercial (Alexandre→Loïc→Rafi)
} as const;

// Défaut = round-robin commercial Alex→Loïc→Rafi (référentiel Loïc §8, validé 03/07 ;
// re-confirmé au call 22/07 : le RDV 15 min « avec un de nos experts » passe par ce lien).
export const DEFAULT_BOOKING_LINK = BOOKING_LINKS.commercial;

// V1: toujours le round-robin commercial. Le mapping fin (par intent/persona) est backlog V2.
export function resolveBookingLink(): string {
  return DEFAULT_BOOKING_LINK;
}
