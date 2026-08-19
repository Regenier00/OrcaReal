-- Cor principal da empresa no app autenticado. Null usa a cor do OrcaReal.
alter table public.companies
  add column if not exists brand_color text;

alter table public.companies
  drop constraint if exists companies_brand_color_hex;

alter table public.companies
  add constraint companies_brand_color_hex
  check (brand_color is null or brand_color ~ '^#[0-9A-Fa-f]{6}$');

comment on column public.companies.brand_color is
  'Cor principal da empresa (botões e destaques). Null mantém a cor do OrcaReal. Não altera cards de receita e custo.';
