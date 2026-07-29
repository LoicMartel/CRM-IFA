-- ═══════════════════════════════════════════════════════════════
-- ETAPE 1 : Creer l'utilisateur via le dashboard Supabase
--   Authentication → Users → Add user → Create new user
--   Email: loic@closing-academie.com
--   Password: Csvolvic241291
--   Cocher "Auto Confirm User"
--
-- ETAPE 2 : Lancer ce SQL dans le SQL Editor
-- ═══════════════════════════════════════════════════════════════

INSERT INTO team_members (auth_user_id, email, first_name, last_name, role, roles, is_active)
SELECT id, 'loic@closing-academie.com', 'Loïc', 'Martel', 'admin', ARRAY['Admin'], true
FROM auth.users WHERE email = 'loic@closing-academie.com'
ON CONFLICT DO NOTHING;
