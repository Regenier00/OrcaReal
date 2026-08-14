create table public.actuals (
    id uuid primary key default uuid_generate_v4(),
    company_id uuid not null references public.companies(id) on delete cascade,
    activity_id uuid references public.activities(id) on delete set null,
    department_id uuid references public.departments(id) on delete set null,
    cost_center_id uuid references public.cost_centers(id) on delete set null,
    date date not null,
    description text,
    amount numeric(15,2) not null default 0,
    created_at timestamptz not null default now()
);