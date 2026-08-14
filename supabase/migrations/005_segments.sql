-- Catálogo global de segmentos/ramos
create table public.segments (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);
