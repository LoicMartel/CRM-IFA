// Deterministic upstream filter (chantier F P1) — runs BEFORE the LLM on copilot accounts.
// Drops obvious non-leads (no-reply / internal / automated / newsletter) so Rafi's loaded mailbox
// doesn't spend a classify call (and never lands in the feed) on noise. Conservative by design:
// when in doubt we let it through and let the interest score decide — missing a real lead is worse
// than one cheap extra LLM call.
//
// ⚠️ The Unipile email webhook is FLAT (no mail headers) → no List-Unsubscribe. We filter on the
// sender identifier + subject/body text only (cf. spec F finding).

// Automated / non-lead sender local-parts (the bit before @). Exported: the mailbox triage (chantier C)
// reuses the same noise heuristics (source unique) for its deterministic upstream.
export const NOISE_LOCAL = /^(no-?reply|donotreply|do-not-reply|mailer-daemon|postmaster|bounce|newsletter|notifications?|mailing|marketing)\b/i;
const INTERNAL_DOMAIN = "@closing-academie.com";
// Newsletter/marketing body footers (conservative content heuristic).
export const NEWSLETTER_BODY = /se d[ée]sinscrire|unsubscribe|voir (?:cet?|ce) (?:e?-?mail|message) dans (?:votre|le) navigateur|ne plus recevoir (?:nos|ces|cet)/i;

// Pure-robot senders: nobody ever replies to them, and an inbound from one is never a lead —
// typically a bounce (mailer-daemon) coming back after the agent mailed an invalid address.
// Deliberately NARROWER than NOISE_LOCAL: "marketing@" or "newsletter@" can be a real prospect
// writing from a generic company box, so those are only silenced, never dropped.
const SYSTEM_LOCAL = /^(no-?reply|donotreply|do-not-reply|mailer-daemon|postmaster|bounce)\b/i;

/**
 * True ⇒ this inbound comes from a mail robot: on an AGENT box it is dropped BEFORE ingestion
 * (no ghost contact in the CRM, no conversation, no LLM call, no escalation). Chat handles
 * (phone, no "@") are never system senders.
 */
export function isSystemSender(senderHandle: string | null): boolean {
  const from = (senderHandle ?? "").trim().toLowerCase();
  if (!from.includes("@")) return false;
  return SYSTEM_LOCAL.test(from.split("@")[0]);
}

/**
 * True ⇒ this inbound is noise: skip scoring (no LLM call) and never promote it to the feed.
 * Copilot accounts skip scoring; agent accounts pin it to 'human' (never an auto reply).
 * Chat handles (phone, no "@") are never skipped.
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
