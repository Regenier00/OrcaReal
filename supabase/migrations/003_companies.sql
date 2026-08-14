create table public.companies (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    document text,
    business_type text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);