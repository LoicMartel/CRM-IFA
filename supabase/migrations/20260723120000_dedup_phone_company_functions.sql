-- Normalisation de téléphone : supprime tout sauf chiffres, gère +33/0033/33
CREATE OR REPLACE FUNCTION normalize_phone_number(p text) RETURNS text AS $$
BEGIN
  IF p IS NULL OR p = '' THEN RETURN NULL; END IF;
  p := regexp_replace(p, '[^0-9]', '', 'g');
  IF length(p) = 12 AND p LIKE '0033%' THEN
    p := '0' || substring(p from 5);
  END IF;
  IF length(p) = 11 AND p LIKE '33%' THEN
    p := '0' || substring(p from 3);
  END IF;
  RETURN p;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Recherche de contact par téléphone normalisé
CREATE OR REPLACE FUNCTION find_contact_by_normalized_phone(p_phone text)
RETURNS TABLE(id uuid, email text, phone text, lifecycle_stage text) AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.email, c.phone, c.lifecycle_stage
  FROM contacts c
  WHERE c.phone IS NOT NULL AND c.phone != ''
    AND normalize_phone_number(c.phone) = p_phone
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- Normalisation de nom d'entreprise
CREATE OR REPLACE FUNCTION normalize_company_name(n text) RETURNS text AS $$
BEGIN
  IF n IS NULL OR n = '' THEN RETURN NULL; END IF;
  n := lower(n);
  n := replace(replace(replace(n, '-', ' '), '_', ' '), '.', ' ');
  n := regexp_replace(n, '\s+', ' ', 'g');
  n := trim(n);
  RETURN n;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Recherche d'entreprise par nom normalisé
CREATE OR REPLACE FUNCTION find_company_by_normalized_name(p_name text)
RETURNS TABLE(id uuid, name text) AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.name
  FROM companies c
  WHERE normalize_company_name(c.name) = p_name
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;
