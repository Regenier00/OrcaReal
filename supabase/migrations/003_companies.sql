-- Empresa: proprietária dos dados
create table public.companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  trade_name text,
  document text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index companies_name_idx on public.companies (name);
