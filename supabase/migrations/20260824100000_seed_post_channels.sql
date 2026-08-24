-- Seed post_channels with the 10 existing hardcoded categories.
-- Uses ON CONFLICT to be idempotent — safe to re-run.

INSERT INTO public.post_channels (slug, label, color_bg, color_text, is_veille, display_order)
VALUES
  ('annonces_generales', 'Annonces Générales',  '#e3f2fd', '#1565c0', false, 1),
  ('lead_gen',           'Lead Gen',            '#fff3e0', '#e65100', false, 2),
  ('commercial',         'Commercial',          '#e8f5e9', '#2e7d32', false, 3),
  ('pedagogie',          'Pédagogie',           '#f3e5f5', '#6a1b9a', false, 4),
  ('pilotage_lca',       'Pilotage LCA',        '#e0f2f1', '#00695c', false, 5),
  ('admin',              'Admin',               '#fce4ec', '#c62828', false, 6),
  ('projets_en_cours',   'Projets en cours',    '#fff8e1', '#f57f17', false, 7),
  ('veille_reglementaire', 'Règlementaire',     '#e8eaf6', '#283593', true,  8),
  ('veille_metiers',     'Métiers',             '#efebe9', '#4e342e', true,  9),
  ('veille_pedagogie',   'Pédagogie (Veille)',  '#fce4ec', '#880e4f', true,  10)
ON CONFLICT (slug) DO UPDATE SET
  label         = EXCLUDED.label,
  color_bg      = EXCLUDED.color_bg,
  color_text    = EXCLUDED.color_text,
  is_veille     = EXCLUDED.is_veille,
  display_order = EXCLUDED.display_order;
