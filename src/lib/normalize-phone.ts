const BLACKLISTED_PHONES = new Set(["0600000000", "0606060606", "0612345678"]);

/**
 * Normalize a phone number: strip non-digits, handle +33/0033/33 prefix.
 * Result is always "0XXXXXXXXX" for French numbers.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone || !phone.trim()) return null;
  let n = phone.replace(/[^\d]/g, "");
  if (n.length === 12 && n.startsWith("0033")) n = "0" + n.slice(4);
  if (n.length === 11 && n.startsWith("33")) n = "0" + n.slice(2);
  return n || null;
}

export function isBlacklistedPhone(phone: string | null): boolean {
  if (!phone) return true;
  return BLACKLISTED_PHONES.has(phone);
}
