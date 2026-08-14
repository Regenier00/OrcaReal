create table public.features (
    id uuid primary key default uuid_generate_v4(),
    company_id uuid not null references public.companies(id) on delete cascade,
    name text not null,
    description text,
    enabled boolean not null default true,
    created_at timestamptz not null default now()
);