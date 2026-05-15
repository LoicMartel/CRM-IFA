-- Migration 1 : Creer un type enum pour les modalites de financement
-- Valeurs : UP FRONT, OPCO, CPF, autre
-- Pas de modification des colonnes existantes (funding_type reste text pour l'instant)

CREATE TYPE payment_terms AS ENUM ('UP FRONT', 'OPCO', 'CPF', 'autre');
