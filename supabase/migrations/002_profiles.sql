-- Perfis de usuário (identidade da aplicação, separado de auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_email_idx on public.profiles (email);
