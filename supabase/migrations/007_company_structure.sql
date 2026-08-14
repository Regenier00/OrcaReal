create table public.departments (
    id uuid primary key default uuid_generate_v4(),
    company_id uuid not null references public.companies(id) on delete cascade,
    name text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.cost_centers (
    id uuid primary key default uuid_generate_v4(),
    company_id uuid not null references public.companies(id) on delete cascade,
    department_id uuid not null references public.departments(id) on delete cascade,
    name text not null,
    code text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);