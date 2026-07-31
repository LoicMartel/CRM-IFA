-- Configurable resource links (replaces hardcoded Google Drive links)
CREATE TABLE resource_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'commercial',
  name text NOT NULL,
  description text,
  url text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE resource_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read resource_links" ON resource_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage resource_links" ON resource_links FOR ALL TO authenticated USING (true) WITH CHECK (true);
