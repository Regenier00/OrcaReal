-- Perfil, atividades e settings da empresa (dados personalizados, não globais)
create table public.company_profiles (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null unique references public.companies (id) on delete cascade,
  segment_id uuid references public.segments (id) on delete set null,
  company_size text,
  financial_control_method text,
  main_objective text,
  maturity_level text,
  profile_summary text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_activities (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (company_id, activity_id)
);

create index company_activities_company_id_idx on public.company_activities (company_id);

create table public.company_settings (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null unique references public.companies (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
