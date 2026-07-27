-- Traçabilité signature Firma par signing_request_id (au lieu du tag UUID dans le nom).
alter table deals add column if not exists firma_devis_signing_id text;
alter table deals add column if not exists firma_convention_signing_id text;
create index if not exists idx_deals_firma_devis_signing on deals (firma_devis_signing_id) where firma_devis_signing_id is not null;
create index if not exists idx_deals_firma_convention_signing on deals (firma_convention_signing_id) where firma_convention_signing_id is not null;
