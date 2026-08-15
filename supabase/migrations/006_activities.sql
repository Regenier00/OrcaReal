-- Catálogo global de atividades
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  segment_id uuid references public.segments (id) on delete set null,
  created_at timestamptz not null default now()
);

create index activities_segment_id_idx on public.activities (segment_id);
