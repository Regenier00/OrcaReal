-- Relação usuário ↔ empresa (multiempresa)
create table public.company_users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'owner'
    check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create index company_users_user_id_idx on public.company_users (user_id);
create index company_users_company_id_idx on public.company_users (company_id);
