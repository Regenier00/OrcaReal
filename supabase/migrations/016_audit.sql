-- Auditoria de operações relevantes
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_company_id_idx on public.audit_logs (company_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
