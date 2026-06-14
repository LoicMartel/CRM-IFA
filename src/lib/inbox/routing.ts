import { svc, resolveOwnerId } from "./ingest";
import { resolveBookingLink } from "./booking-links";

// Routing socle shared by the agent leads (D), the copilote Rafi (F) and the mailbox triage (C).
// The MODE resolved from a webhook's account_id decides what the engine is allowed to do:
//   agent    = leads full-auto (greeting -> qualify -> booking).  ← chantier D (proven)
//   copilot  = Rafi's channels: score -> feed/CRM, reply gated.   ← chantier F (P2/P3)
//   classify = Rafi's mailbox: label only, NEVER replies.         ← chantier C
export type InboxMode = "agent" | "copilot" | "classify";
export type ReplyMode = "off" | "draft" | "auto";

const DEFAULT_DISPLAY_NAME = "Rafi";

// Persona (de-hardcoded from agent.ts). P1 only needs name/signature/booking link;
// voiceProfile (brand-voice block) lands at chantier F P2.
export interface InboxPersona {
  displayName: string;
  signature: string;        // resolved (never null): row.signature || "{displayName}, Expert La Closing Académie"
  bookingLink: string;      // resolved (never null): row.booking_link || resolveBookingLink()
  voiceProfile: string | null;
}

export interface ResolvedAccount {
  mode: InboxMode;
  ownerId: string | null;
  replyMode: ReplyMode;
  persona: InboxPersona;
  autoFile: boolean; // P2 classify : déplacer le mail dans le dossier IMAP après étiquetage (défaut false)
}

interface AccountRow {
  mode?: string | null;
  owner_id?: string | null;
  reply_mode?: string | null;
  display_name?: string | null;
  signature?: string | null;
  voice_profile?: string | null;
  booking_link?: string | null;
  active?: boolean | null;
  auto_file?: boolean | null;
}

// LCA default persona — keeps the leads agent (mode=agent) byte-for-byte unchanged.
function buildPersona(row?: AccountRow | null): InboxPersona {
  const displayName = row?.display_name?.trim() || DEFAULT_DISPLAY_NAME;
  return {
    displayName,
    signature: row?.signature?.trim() || `${displayName}, Expert La Closing Académie`,
    bookingLink: row?.booking_link?.trim() || resolveBookingLink(),
    voiceProfile: row?.voice_profile?.trim() || null,
  };
}

// Env fallback (bootstrap before inbox_accounts is populated): mode only, no persona/owner.
function readEnvMode(accountId: string): InboxMode | null {
  try {
    const map = JSON.parse(process.env.INBOX_ACCOUNT_ROUTING ?? "{}") as Record<string, unknown>;
    const m = map?.[accountId];
    if (m === "agent" || m === "copilot" || m === "classify") return m;
  } catch { /* malformed env → ignore, fall through to fail-safe */ }
  return null;
}

/**
 * Resolve how an inbound on `accountId` must be handled.
 * Precedence: inbox_accounts table (active row) → INBOX_ACCOUNT_ROUTING env → fail-safe `classify`.
 * - `accountId === null` (web_form / legacy) ⇒ `agent` (chantier D), LCA persona.
 * - An unknown connected account ⇒ `classify` (NEVER auto-replies) — the 09/06 "loaded box" guard.
 *   The dedicated leads box must therefore be listed explicitly as mode='agent' (table or env).
 */
export async function resolveInboxAccount(accountId: string | null): Promise<ResolvedAccount> {
  const sb = svc();

  // web_form / legacy: no Unipile account → the leads agent. Persona = LCA default.
  if (!accountId) {
    return { mode: "agent", ownerId: await resolveOwnerId(sb), replyMode: "auto", persona: buildPersona(null), autoFile: false };
  }

  // Table is source of truth (only an active row counts; a deactivated box must not keep replying).
  try {
    const { data, error } = await sb.from("inbox_accounts")
      .select("mode, owner_id, reply_mode, display_name, signature, voice_profile, booking_link, active, auto_file")
      .eq("account_id", accountId).maybeSingle();
    if (!error && data) {
      const row = data as AccountRow;
      if (row.active === true) {
        const mode = (row.mode === "agent" || row.mode === "copilot" || row.mode === "classify") ? row.mode : "classify";
        const replyMode = (row.reply_mode === "off" || row.reply_mode === "draft" || row.reply_mode === "auto") ? row.reply_mode : "off";
        return {
          mode,
          ownerId: row.owner_id ?? (await resolveOwnerId(sb)),
          replyMode,
          persona: buildPersona(row),
          autoFile: mode === "classify" && row.auto_file === true, // P2 : auto-classement only en mode classify
        };
      }
      // Row exists but DEACTIVATED → fail-safe classify, and do NOT let the env fallback re-activate
      // it (a box turned off in the table must stay off, whatever INBOX_ACCOUNT_ROUTING says).
      console.warn(`[inbox.routing] account ${accountId} is deactivated (inbox_accounts.active=false) → 'classify' (env ignored).`);
      return { mode: "classify", ownerId: row.owner_id ?? (await resolveOwnerId(sb)), replyMode: "off", persona: buildPersona(row), autoFile: false };
    }
  } catch (e) {
    console.error("[inbox.routing] inbox_accounts lookup failed (table missing? falling back to env):", e);
  }

  // Env fallback (mode only).
  const envMode = readEnvMode(accountId);
  if (envMode) {
    return { mode: envMode, ownerId: await resolveOwnerId(sb), replyMode: "off", persona: buildPersona(null), autoFile: false };
  }

  // Fail-safe: an unconfigured connected account never auto-replies.
  console.warn(`[inbox.routing] account ${accountId} not configured (inbox_accounts / INBOX_ACCOUNT_ROUTING) → 'classify' fail-safe (agent won't reply). List it as mode='agent' to enable the leads agent on this box.`);
  return { mode: "classify", ownerId: await resolveOwnerId(sb), replyMode: "off", persona: buildPersona(null), autoFile: false };
}

/** Convenience: persona only (resolved from account_id; LCA default when null/unconfigured). */
export async function resolvePersona(accountId: string | null): Promise<InboxPersona> {
  return (await resolveInboxAccount(accountId)).persona;
}

/**
 * Account ids handled in `classify` mode (mailbox triage — chantier C).
 * Used to EXCLUDE them from the leads inbox/digest (Rafi's mail is sorted into his own mailbox via
 * IMAP, never surfaced in the CRM leads views).
 * NOTE: no `active` filter — a classify box left deactivated still resolves to `classify` (fail-safe,
 * its inbound is pinned 'human' + labelled), so its mail must stay out of the leads views too.
 * Best-effort: returns [] if the table is missing (no isolation rather than a crash).
 */
export async function listClassifyAccountIds(): Promise<string[]> {
  const sb = svc();
  try {
    const { data, error } = await sb.from("inbox_accounts").select("account_id").eq("mode", "classify");
    if (error || !data) return [];
    return data.map((r) => r.account_id as string).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * PostgREST `.or(...)` predicate that EXCLUDES the given account ids while KEEPING rows with a null
 * account_id (web_form leads — `NOT IN` would drop NULLs). Returns null when there is nothing to
 * exclude so the caller can skip the filter entirely.
 */
export function classifyExclusionOr(ids: string[]): string | null {
  if (!ids.length) return null;
  const list = ids.map((id) => `"${id.replace(/["(),]/g, "")}"`).join(",");
  return `account_id.is.null,account_id.not.in.(${list})`;
}
