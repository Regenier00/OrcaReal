-- Alertas e resultados de indicadores (estrutura preparatória)
create table public.alerts (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies (id) on delete cascade,
  code text,
  title text not null,
  message text,
  severity text not null default 'info'
    check (severity in ('info', 'warning', 'critical')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index alerts_company_id_idx on public.alerts (company_id);

create table public.indicator_results (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies (id) on delete cascade,
  indicator_id uuid references public.system_indicators (id) on delete set null,
  period_id uuid references public.periods (id) on delete set null,
  value numeric(18, 4),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index indicator_results_company_id_idx on public.indicator_results (company_id);
