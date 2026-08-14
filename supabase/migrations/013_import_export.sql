-- Importação / exportação: estruturas base (templates versionados + histórico)
create table public.import_templates (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  name text not null,
  version text not null default '1.0',
  kind text not null default 'budget'
    check (kind in ('budget', 'actual', 'structure')),
  schema_definition jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.imports (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies (id) on delete cascade,
  template_id uuid references public.import_templates (id) on delete set null,
  file_name text,
  status text not null default 'pending'
    check (status in ('pending', 'validated', 'imported', 'failed')),
  row_count integer not null default 0,
  error_count integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index imports_company_id_idx on public.imports (company_id);

create table public.import_errors (
  id uuid primary key default uuid_generate_v4(),
  import_id uuid not null references public.imports (id) on delete cascade,
  row_number integer,
  field_name text,
  message text not null,
  created_at timestamptz not null default now()
);

create index import_errors_import_id_idx on public.import_errors (import_id);

create table public.export_templates (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  name text not null,
  version text not null default '1.0',
  kind text not null default 'report'
    check (kind in ('report', 'budget', 'dashboard')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.exports (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies (id) on delete cascade,
  template_id uuid references public.export_templates (id) on delete set null,
  file_name text,
  format text not null default 'xlsx'
    check (format in ('xlsx', 'pdf')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index exports_company_id_idx on public.exports (company_id);
