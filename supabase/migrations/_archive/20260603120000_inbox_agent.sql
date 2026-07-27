-- Inbox 360° + agent leads inbound
-- RLS admin check mirrors the repo's hardened precedent (20260529000000_harden_engagements_rls.sql):
-- team_members.roles is a text[] array, admin value is capitalized => `'Admin' = ANY(roles)`.
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('linkedin','email','whatsapp','instagram','messenger','sms','web_form')),
  account_id text,
  external_chat_id text,
  subject text,
  category text CHECK (category IS NULL OR category IN ('a','b','c')),
  intent text CHECK (intent IS NULL OR intent IN ('rdv','devis','question','spam','autre')),
  agent_status text NOT NULL DEFAULT 'human'
    CHECK (agent_status IN ('active','human','escalated','booked','dormant')),
  escalation_reason text CHECK (escalation_reason IS NULL OR escalation_reason IN
    ('high_value','explicit_human','low_confidence','keyword','off_script','negative','existing_contact','linkedin')),
  agent_last_acted_at timestamptz,
  agent_turn_count int NOT NULL DEFAULT 0,
  unread boolean NOT NULL DEFAULT true,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  owner_id uuid REFERENCES team_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  sent_by text NOT NULL DEFAULT 'lead' CHECK (sent_by IN ('lead','agent','human')),
  sender_name text,
  sender_handle text,
  body text NOT NULL DEFAULT '',
  external_message_id text,
  is_draft boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','draft','validated','sent','failed')),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_escalation_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS messages_external_id_uniq
  ON messages (external_message_id) WHERE external_message_id IS NOT NULL;
-- Prevent duplicate conversations for the same chat under concurrent first-message deliveries.
CREATE UNIQUE INDEX IF NOT EXISTS conversations_chat_uniq
  ON conversations (channel, external_chat_id) WHERE external_chat_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS conversations_inbox_idx ON conversations (owner_id, agent_status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversations_followup_idx ON conversations (agent_status, agent_last_acted_at)
  WHERE agent_status = 'active';
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (conversation_id, created_at);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_escalation_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_select_authenticated" ON conversations FOR SELECT TO authenticated USING (true);
CREATE POLICY "conversations_write_admin" ON conversations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM team_members WHERE auth_user_id = auth.uid() AND 'Admin' = ANY(roles)))
  WITH CHECK (EXISTS (SELECT 1 FROM team_members WHERE auth_user_id = auth.uid() AND 'Admin' = ANY(roles)));
CREATE POLICY "messages_select_authenticated" ON messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "messages_write_admin" ON messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM team_members WHERE auth_user_id = auth.uid() AND 'Admin' = ANY(roles)))
  WITH CHECK (EXISTS (SELECT 1 FROM team_members WHERE auth_user_id = auth.uid() AND 'Admin' = ANY(roles)));
CREATE POLICY "keywords_select_authenticated" ON agent_escalation_keywords FOR SELECT TO authenticated USING (true);
CREATE POLICY "keywords_write_admin" ON agent_escalation_keywords FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM team_members WHERE auth_user_id = auth.uid() AND 'Admin' = ANY(roles)))
  WITH CHECK (EXISTS (SELECT 1 FROM team_members WHERE auth_user_id = auth.uid() AND 'Admin' = ANY(roles)));
