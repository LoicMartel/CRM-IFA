-- Inbox account routing + persona (socle commun chantiers F "copilote" et C "tri courrier").
-- One row per connected Unipile account. Single source of truth for the routing MODE, the OWNER,
-- and the PERSONA (voice/signature/booking link) of that account.
--
-- Modes:
--   agent    = leads full-auto (the proven agent: greeting -> qualify -> booking). Dedicated leads box.
--   copilot  = Rafi's own channels: score -> feed/CRM, reply gated by reply_mode (chantier F P2/P3).
--   classify = Rafi's mailbox: label only, NEVER replies (chantier C).
--
-- ⚠️ FAIL-SAFE BY DESIGN: a connected Unipile account that is NOT listed here (and not in the
-- INBOX_ACCOUNT_ROUTING env fallback) resolves to `classify` in code => the agent will NOT reply.
-- This prevents the agent from ever auto-replying on a surprise/personal box (the 09/06 finding).
-- => AT CUTOVER, the DEDICATED LEADS account MUST be inserted here with mode='agent', e.g.:
--     INSERT INTO inbox_accounts (account_id, channel, mode, owner_id, booking_link)
--     VALUES ('<unipile_leads_account_id>', 'email', 'agent',
--             (SELECT id FROM team_members WHERE email = 'rafi@closing-academie.com'), NULL);
-- web_form leads (account_id = null at /api/leads/inbound) are resolved to `agent` in code,
-- independently of this table.
CREATE TABLE IF NOT EXISTS inbox_accounts (
  account_id text PRIMARY KEY,                       -- Unipile account id (present in every webhook)
  channel text CHECK (channel IS NULL OR channel IN ('email','whatsapp','linkedin','instagram','messenger')),
  mode text NOT NULL DEFAULT 'classify' CHECK (mode IN ('agent','copilot','classify')),
  owner_id uuid REFERENCES team_members(id) ON DELETE SET NULL,
  reply_mode text NOT NULL DEFAULT 'off' CHECK (reply_mode IN ('off','draft','auto')),
  display_name text,                                 -- persona name shown in signature (e.g. "Rafi")
  signature text,                                    -- signature block (defaults to "{display_name}, Expert La Closing Académie")
  voice_profile text,                                -- brand-voice block (8 dims) — filled at P2, nullable
  booking_link text,                                 -- this owner's round-robin booking link (nullable -> code default)
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inbox_accounts ENABLE ROW LEVEL SECURITY;

-- RLS admin check mirrors the repo's hardened precedent (20260529000000_harden_engagements_rls.sql):
-- team_members.roles is a text[] array, admin value is capitalized => `'Admin' = ANY(roles)`.
CREATE POLICY "inbox_accounts_select_authenticated" ON inbox_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "inbox_accounts_write_admin" ON inbox_accounts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM team_members WHERE auth_user_id = auth.uid() AND 'Admin' = ANY(roles)))
  WITH CHECK (EXISTS (SELECT 1 FROM team_members WHERE auth_user_id = auth.uid() AND 'Admin' = ANY(roles)));
