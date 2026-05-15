-- Migration 4 : Table engagements
-- Historique structure des interactions commerciales (appels, emails, notes, taches...)
-- Colonnes call_result et call_outcome dediees pour les appels (au lieu du texte libre dans description)

CREATE TABLE engagements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Type d'activite
  type text NOT NULL
    CHECK (type IN ('appel', 'email', 'reunion', 'note', 'tache', 'relance')),

  title text NOT NULL,
  description text,
  due_date timestamptz,

  -- Resultat d'appel (uniquement si type = appel)
  call_result text
    CHECK (call_result IN ('no_answer', 'voicemail', 'contacted', 'not_interested')),
  call_outcome text
    CHECK (call_outcome IN ('not_booked', 'booked')),

  -- Relations
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id),
  lead_id uuid REFERENCES leads(id),
  deal_id uuid REFERENCES deals(id),
  team_member_id uuid REFERENCES team_members(id),

  -- Taches
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  task_deadline date,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index pour les requetes frequentes
CREATE INDEX idx_engagements_contact_id ON engagements(contact_id);
CREATE INDEX idx_engagements_type ON engagements(type);
CREATE INDEX idx_engagements_created_at ON engagements(created_at DESC);

-- RLS
ALTER TABLE engagements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON engagements
  FOR ALL USING (true) WITH CHECK (true);
