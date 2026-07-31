CREATE TABLE team_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color_bg text NOT NULL DEFAULT '#e3f2fd',
  color_text text NOT NULL DEFAULT '#1565c0',
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

INSERT INTO team_roles (name, color_bg, color_text, display_order) VALUES
  ('Admin', '#fce4ec', '#c62828', 0),
  ('Dirigeant', '#f3e5f5', '#6a1b9a', 1),
  ('Account Manager', '#fff3e0', '#e65100', 2),
  ('Expert', '#e8f0fe', '#161f45', 3),
  ('Experte', '#e8f0fe', '#161f45', 4),
  ('Coordinatrice Pédagogique', '#e8f5e9', '#2e7d32', 5),
  ('Marketing Manager', '#fce4ec', '#ad1457', 6),
  ('Ingénieure Pédagogique', '#e0f2f1', '#00695c', 7),
  ('Interne', '#e3f2fd', '#1565c0', 8),
  ('Externe', '#fff8e1', '#f57f17', 9);

ALTER TABLE team_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_team_roles" ON team_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage_team_roles" ON team_roles FOR ALL TO authenticated USING (true) WITH CHECK (true);
