-- Logo da empresa: URL pública ou data URL gerada no cadastro da marca.
alter table public.companies
  add column if not exists logo_url text;
