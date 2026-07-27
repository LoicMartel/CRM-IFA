-- P0.4 — Durcir la RLS de `engagements`
-- Remplace la policy permissive "Allow all for authenticated" (USING true / WITH CHECK true)
-- qui n'offrait aucune isolation.
--
-- NB : le CRM accède aujourd'hui à `engagements` majoritairement via service_role
-- (qui bypass la RLS) ; cette policy protège donc surtout les accès anon-key
-- directs depuis le front. Modèle retenu : lecture partagée équipe (CRM interne),
-- écriture réservée au propriétaire (team_member lié à auth.uid()) ou aux Admin.

DROP POLICY IF EXISTS "Allow all for authenticated" ON engagements;

-- Helper inline : l'utilisateur courant est-il Admin ?
-- (exprimé directement dans chaque policy pour éviter une fonction SECURITY DEFINER)

-- Lecture : toute l'équipe authentifiée (visibilité partagée, comportement actuel préservé)
CREATE POLICY "engagements_select_authenticated" ON engagements
  FOR SELECT TO authenticated
  USING (true);

-- Insertion : propriétaire de l'engagement ou Admin
CREATE POLICY "engagements_insert_owner_or_admin" ON engagements
  FOR INSERT TO authenticated
  WITH CHECK (
    team_member_id IN (
      SELECT id FROM team_members WHERE auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE auth_user_id = auth.uid() AND 'Admin' = ANY(roles)
    )
  );

-- Mise à jour : propriétaire ou Admin
CREATE POLICY "engagements_update_owner_or_admin" ON engagements
  FOR UPDATE TO authenticated
  USING (
    team_member_id IN (
      SELECT id FROM team_members WHERE auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE auth_user_id = auth.uid() AND 'Admin' = ANY(roles)
    )
  );

-- Suppression : propriétaire ou Admin
CREATE POLICY "engagements_delete_owner_or_admin" ON engagements
  FOR DELETE TO authenticated
  USING (
    team_member_id IN (
      SELECT id FROM team_members WHERE auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE auth_user_id = auth.uid() AND 'Admin' = ANY(roles)
    )
  );
