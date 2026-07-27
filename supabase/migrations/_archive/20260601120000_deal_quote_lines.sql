alter table deals add column if not exists quote_lines jsonb;
alter table deals add column if not exists quote_subject text;
alter table deals add column if not exists quote_pdf_description text;
