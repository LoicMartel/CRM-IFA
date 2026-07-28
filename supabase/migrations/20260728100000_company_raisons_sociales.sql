-- Raisons sociales (entités juridiques) rattachées à une entreprise.
--
-- Les deux tables ont été créées à la main en prod le 28/07 (commit 8cee1b3, UI seule).
-- Cette migration les reprend à l'identique pour que le repo redevienne reproductible,
-- ajoute la RLS (absente sur une table créée hors migration) et la colonne de rattachement
-- côté deals utilisée par la génération devis/convention.
--
-- Idempotente : `IF NOT EXISTS` sur les objets déjà présents en prod ; seules la RLS,
-- les policies et `deals.raison_sociale_id` y produisent un effet réel.

CREATE TABLE IF NOT EXISTS company_raisons_sociales (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  siret       text,
  address     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS raison_sociale_learners (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raison_sociale_id uuid NOT NULL REFERENCES company_raisons_sociales(id) ON DELETE CASCADE,
  learner_id        uuid NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_raisons_sociales_company
  ON company_raisons_sociales (company_id);
CREATE INDEX IF NOT EXISTS idx_raison_sociale_learners_rs
  ON raison_sociale_learners (raison_sociale_id);
CREATE INDEX IF NOT EXISTS idx_raison_sociale_learners_learner
  ON raison_sociale_learners (learner_id);

-- Un apprenant n'est rattaché qu'une fois à la même raison sociale.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_raison_sociale_learner
  ON raison_sociale_learners (raison_sociale_id, learner_id);

-- Rattachement du deal à l'entité pour laquelle devis + convention sont édités.
-- NULL = pas d'entité choisie -> on retombe sur les infos de l'entreprise.
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS raison_sociale_id uuid
  REFERENCES company_raisons_sociales(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deals_raison_sociale ON deals (raison_sociale_id);

-- --- RLS -------------------------------------------------------------------
-- Modèle du CRM : données internes partagées par l'équipe authentifiée.
-- L'enjeu ici est de fermer l'accès anon-key depuis le navigateur (les deux tables
-- portent SIRET, adresses et apprenants nominatifs).

ALTER TABLE company_raisons_sociales ENABLE ROW LEVEL SECURITY;
ALTER TABLE raison_sociale_learners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_raisons_sociales_all_authenticated" ON company_raisons_sociales;
CREATE POLICY "company_raisons_sociales_all_authenticated" ON company_raisons_sociales
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "raison_sociale_learners_all_authenticated" ON raison_sociale_learners;
CREATE POLICY "raison_sociale_learners_all_authenticated" ON raison_sociale_learners
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
