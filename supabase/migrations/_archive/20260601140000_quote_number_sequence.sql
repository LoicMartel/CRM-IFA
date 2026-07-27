-- Devis V2 : numérotation CRM-native DEV-{année}-{NNN}
-- (Déjà appliquée en prod via SQL editor le 01/06 — fichier idempotent pour traçabilité/repro.)
alter table deals add column if not exists quote_number text;

create table if not exists quote_sequences (
  year int primary key,
  last_value int not null default 0
);

create or replace function next_quote_number(p_year int)
returns int
language sql
as $$
  insert into quote_sequences (year, last_value) values (p_year, 1)
  on conflict (year) do update set last_value = quote_sequences.last_value + 1
  returning last_value;
$$;
