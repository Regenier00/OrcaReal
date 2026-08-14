-- Estrutura organizacional: departamentos, centros de custo (N:N) e categorias
create table public.departments (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index departments_company_id_idx on public.departments (company_id);

create table public.cost_centers (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  code text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cost_centers_company_id_idx on public.cost_centers (company_id);

-- Relação N:N departamento ↔ centro de custo
create table public.department_cost_centers (
  id uuid primary key default uuid_generate_v4(),
  department_id uuid not null references public.departments (id) on delete cascade,
  cost_center_id uuid not null references public.cost_centers (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (department_id, cost_center_id)
);

create index department_cost_centers_department_id_idx
  on public.department_cost_centers (department_id);
create index department_cost_centers_cost_center_id_idx
  on public.department_cost_centers (cost_center_id);

create table public.categories (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  category_type text not null default 'expense'
    check (category_type in ('revenue', 'expense', 'cost')),
  parent_id uuid references public.categories (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index categories_company_id_idx on public.categories (company_id);
