-- Inbox interest scoring (chantier F P1 — copilote Rafi: score -> feed/CRM, zéro réponse).
-- Two columns on conversations, filled by the enriched classify (1 LLM call, no extra call).
-- Nullable: only the copilote/agent classify path writes them; the mailbox-triage path (C) doesn't.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS interest_score int;        -- 0-100, opportunity probability
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS score_reason text;          -- short justification (inbox + feed)
