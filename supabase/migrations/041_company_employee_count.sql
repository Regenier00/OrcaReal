-- Quantidade de funcionários no perfil, usada nos indicadores por pessoa.
alter table public.company_profiles
  add column if not exists employee_count integer;

alter table public.company_profiles
  drop constraint if exists company_profiles_employee_count_positive;

alter table public.company_profiles
  add constraint company_profiles_employee_count_positive
  check (employee_count is null or employee_count > 0);

update public.onboarding_questions
set
  question = 'Informe a quantidade de funcionários que a empresa possui para uma experiência personalizada',
  help_text = 'Esse número preenche os indicadores de receita e custo por funcionário.',
  answer_type = 'number',
  options = '[]'::jsonb,
  maps_to = 'profile.employee_count',
  is_active = true
where code = 'employee_count';
