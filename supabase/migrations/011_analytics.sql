create table public.analytics (
    id uuid primary key default uuid_generate_v4(),
    company_id uuid not null references public.companies(id) on delete cascade,
    reference_date date not null,
    budget_amount numeric(15,2) not null default 0,
    actual_amount numeric(15,2) not null default 0,
    created_at timestamptz not null default now()
);