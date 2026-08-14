-- Financeiro (fundação apenas).
-- NÃO congelar budgets / budget_items / actual_entries até decisões da §33/§43
-- (chave analítica, conciliação, períodos fechados, estornos, etc.).

create table public.periods (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies (id) on delete cascade,
  year integer not null check (year >= 2000 and year <= 2100),
  month integer not null check (month >= 1 and month <= 12),
  status text not null default 'open'
    check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, year, month)
);

create index periods_company_id_idx on public.periods (company_id);
