-- P2 chantier C — auto-classement IMAP. Flag PAR COMPTE (mode classify) : quand true, après
-- l'étiquetage classifyMailbox, le mail est déplacé dans le dossier IMAP correspondant via Unipile.
-- Défaut false = P1 (l'IA suggère, Rafi range). Gated : inerte tant que false (et tant que pas de token).
ALTER TABLE inbox_accounts ADD COLUMN IF NOT EXISTS auto_file boolean NOT NULL DEFAULT false;
