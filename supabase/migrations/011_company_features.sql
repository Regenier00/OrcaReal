-- Configuração por empresa (cópia/ativação a partir dos defaults do sistema)
create table public.company_features (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  feature_id uuid not null references public.system_features (id) on delete cascade,
  enabled boolean not null default true,
  recommended boolean not null default false,
  created_at timestamptz not null default now(),
  unique (company_id, feature_id)
);

create index company_features_company_id_idx on public.company_features (company_id);

create table public.company_indicators (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  indicator_id uuid not null references public.system_indicators (id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, indicator_id)
);

create index company_indicators_company_id_idx on public.company_indicators (company_id);

create table public.company_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  report_id uuid not null references public.system_reports (id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, report_id)
);

create index company_reports_company_id_idx on public.company_reports (company_id);
