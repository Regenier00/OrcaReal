-- Unidades de operação e indicadores criados pela própria empresa.

create table if not exists public.company_custom_units (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  quantity_noun text not null,
  quantity_noun_singular text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);

create index if not exists company_custom_units_company_id_idx
  on public.company_custom_units (company_id);

create table if not exists public.company_custom_indicators (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  description text,
  unit_source text not null check (unit_source in ('catalog', 'custom')),
  unit_code text not null,
  unit_name text not null,
  quantity_noun text not null,
  quantity_noun_singular text not null,
  custom_unit_id uuid references public.company_custom_units (id) on delete set null,
  formula jsonb not null,
  display_unit text not null,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_custom_indicators_unit_source_check check (
    (unit_source = 'custom' and custom_unit_id is not null)
    or (unit_source = 'catalog' and custom_unit_id is null)
  )
);

create index if not exists company_custom_indicators_company_id_idx
  on public.company_custom_indicators (company_id);

alter table public.company_custom_units enable row level security;
alter table public.company_custom_indicators enable row level security;

drop policy if exists "company_custom_units_all_member" on public.company_custom_units;
create policy "company_custom_units_all_member"
  on public.company_custom_units for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

drop policy if exists "company_custom_indicators_all_member" on public.company_custom_indicators;
create policy "company_custom_indicators_all_member"
  on public.company_custom_indicators for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));
