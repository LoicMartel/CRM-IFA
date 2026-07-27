-- Alignement du modèle de statuts du plan de facturation sur le cycle cadré avec Loïc (04/06) :
--   a_valider → planifie → a_facturer → facture → encaisse  (+ non_fait = état neutre).
-- L'ancien statut 'en_cours' devient 'a_facturer' (même étape : échéance à terme, facture à émettre).
-- billing_months.status est du texte libre (pas de CHECK ni d'enum Postgres) → simple UPDATE,
-- aucun ALTER TYPE requis. Aucun index ne filtre sur 'en_cours' (les index portent sur
-- 'planifie' et (status, invoice_email_sent)), donc rien à recréer.

UPDATE billing_months
  SET status = 'a_facturer'
  WHERE status = 'en_cours';
