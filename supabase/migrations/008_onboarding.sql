-- Onboarding: perguntas do sistema e respostas por empresa
create table public.onboarding_questions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  question text not null,
  help_text text,
  answer_type text not null default 'single'
    check (answer_type in ('single', 'multiple', 'text', 'scale')),
  options jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.onboarding_answers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  question_id uuid not null references public.onboarding_questions (id) on delete cascade,
  answer jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, question_id)
);

create index onboarding_answers_company_id_idx on public.onboarding_answers (company_id);
