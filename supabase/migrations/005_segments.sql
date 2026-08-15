-- Catálogo global de segmentos/ramos
create table public.segments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);
