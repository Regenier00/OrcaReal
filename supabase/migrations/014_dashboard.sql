-- Dashboard personalizável por empresa
create table public.company_dashboards (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null default 'Dashboard padrão',
  layout jsonb not null default '{}'::jsonb,
  theme jsonb not null default '{}'::jsonb,
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index company_dashboards_company_id_idx on public.company_dashboards (company_id);
