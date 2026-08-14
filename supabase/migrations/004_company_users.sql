create table public.company_users (
    id uuid primary key default uuid_generate_v4(),
    company_id uuid not null references public.companies(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    role text not null default 'member',
    created_at timestamptz not null default now(),

    unique (company_id, user_id)
);