// Deterministic upstream filter (chantier F P1) — runs BEFORE the LLM on copilot accounts.
// Drops obvious non-leads (no-reply / internal / automated / newsletter) so Rafi's loaded mailbox
// doesn't spend a classify call (and never lands in the feed) on noise. Conservative by design:
// when in doubt we let it through and let the interest score decide — missing a real lead is worse
// than one cheap extra LLM call.
//
// ⚠️ The Unipile email webhook is FLAT (no mail headers) → no List-Unsubscribe. We filter on the
// sender identifier + subject/body text only (cf. spec F finding).

// Automated / non-lead sender local-parts (the bit before @).
const NOISE_LOCAL = /^(no-?reply|donotreply|do-not-reply|mailer-daemon|postmaster|bounce|newsletter|notifications?|mailing|marketing)\b/i;
const INTERNAL_DOMAIN = "@closing-academie.com";
// Newsletter/marketing body footers (conservative content heuristic).
const NEWSLETTER_BODY = /se d[ée]sinscrire|unsubscribe|voir (?:cet?|ce) (?:e?-?mail|message) dans (?:votre|le) navigateur|ne plus recevoir (?:nos|ces|cet)/i;

/**
 * True ⇒ this inbound is noise: skip scoring (no LLM call) and never promote it to the feed.
 * Only applies to copilot accounts. Chat handles (phone, no "@") are never skipped.
 */
export function shouldSkipScoring(senderHandle: string | null, subject: string | null, body: string): boolean {
  const from = (senderHandle ?? "").trim().toLowerCase();
  if (!from.includes("@")) return false; // chat handle (phone / non-email) → let it through
  const local = from.split("@")[0];
  if (NOISE_LOCAL.test(local)) return true;
  if (from.endsWith(INTERNAL_DOMAIN)) return true; // internal team mail, not a lead
  if (NEWSLETTER_BODY.test(`${subject ?? ""}\n${body}`)) return true;
  return false;
}
