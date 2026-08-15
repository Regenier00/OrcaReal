-- Helpers de autorização multiempresa
create or replace function public.is_company_member(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_users cu
    where cu.company_id = p_company_id
      and cu.user_id = auth.uid()
  );
$$;

create or replace function public.is_company_admin(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_users cu
    where cu.company_id = p_company_id
      and cu.user_id = auth.uid()
      and cu.role in ('owner', 'admin')
  );
$$;

revoke all on function public.is_company_member(uuid) from public;
grant execute on function public.is_company_member(uuid) to authenticated;

revoke all on function public.is_company_admin(uuid) from public;
grant execute on function public.is_company_admin(uuid) to authenticated;

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_users enable row level security;
alter table public.segments enable row level security;
alter table public.activities enable row level security;
alter table public.company_profiles enable row level security;
alter table public.company_activities enable row level security;
alter table public.company_settings enable row level security;
alter table public.onboarding_questions enable row level security;
alter table public.onboarding_answers enable row level security;
alter table public.departments enable row level security;
alter table public.cost_centers enable row level security;
alter table public.department_cost_centers enable row level security;
alter table public.categories enable row level security;
alter table public.system_features enable row level security;
alter table public.system_indicators enable row level security;
alter table public.system_reports enable row level security;
alter table public.company_features enable row level security;
alter table public.company_indicators enable row level security;
alter table public.company_reports enable row level security;
alter table public.periods enable row level security;
alter table public.import_templates enable row level security;
alter table public.imports enable row level security;
alter table public.import_errors enable row level security;
alter table public.export_templates enable row level security;
alter table public.exports enable row level security;
alter table public.company_dashboards enable row level security;
alter table public.alerts enable row level security;
alter table public.indicator_results enable row level security;
alter table public.audit_logs enable row level security;

-- profiles
create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- companies
create policy "companies_select_member"
  on public.companies for select to authenticated
  using (public.is_company_member(id));

create policy "companies_insert_authenticated"
  on public.companies for insert to authenticated
  with check (true);

create policy "companies_update_admin"
  on public.companies for update to authenticated
  using (public.is_company_admin(id))
  with check (public.is_company_admin(id));

-- company_users
create policy "company_users_select_member"
  on public.company_users for select to authenticated
  using (public.is_company_member(company_id) or user_id = auth.uid());

create policy "company_users_insert_self"
  on public.company_users for insert to authenticated
  with check (user_id = auth.uid());

create policy "company_users_update_admin"
  on public.company_users for update to authenticated
  using (public.is_company_admin(company_id))
  with check (public.is_company_admin(company_id));

-- Catálogos globais: leitura para autenticados
create policy "segments_select_authenticated"
  on public.segments for select to authenticated using (true);

create policy "activities_select_authenticated"
  on public.activities for select to authenticated using (true);

create policy "onboarding_questions_select_authenticated"
  on public.onboarding_questions for select to authenticated
  using (is_active = true);

create policy "system_features_select_authenticated"
  on public.system_features for select to authenticated
  using (is_active = true);

create policy "system_indicators_select_authenticated"
  on public.system_indicators for select to authenticated
  using (is_active = true);

create policy "system_reports_select_authenticated"
  on public.system_reports for select to authenticated
  using (is_active = true);

create policy "import_templates_select_authenticated"
  on public.import_templates for select to authenticated
  using (is_active = true);

create policy "export_templates_select_authenticated"
  on public.export_templates for select to authenticated
  using (is_active = true);

-- Tabelas por empresa: isolamento via membership
create policy "company_profiles_all_member"
  on public.company_profiles for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy "company_activities_all_member"
  on public.company_activities for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy "company_settings_all_member"
  on public.company_settings for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy "onboarding_answers_all_member"
  on public.onboarding_answers for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy "departments_all_member"
  on public.departments for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy "cost_centers_all_member"
  on public.cost_centers for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy "department_cost_centers_select_member"
  on public.department_cost_centers for select to authenticated
  using (
    exists (
      select 1 from public.departments d
      where d.id = department_id
        and public.is_company_member(d.company_id)
    )
  );

create policy "department_cost_centers_write_member"
  on public.department_cost_centers for insert to authenticated
  with check (
    exists (
      select 1 from public.departments d
      where d.id = department_id
        and public.is_company_member(d.company_id)
    )
  );

create policy "department_cost_centers_delete_member"
  on public.department_cost_centers for delete to authenticated
  using (
    exists (
      select 1 from public.departments d
      where d.id = department_id
        and public.is_company_member(d.company_id)
    )
  );

create policy "categories_all_member"
  on public.categories for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy "company_features_all_member"
  on public.company_features for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy "company_indicators_all_member"
  on public.company_indicators for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy "company_reports_all_member"
  on public.company_reports for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy "periods_all_member"
  on public.periods for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy "imports_all_member"
  on public.imports for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy "import_errors_select_member"
  on public.import_errors for select to authenticated
  using (
    exists (
      select 1 from public.imports i
      where i.id = import_id
        and public.is_company_member(i.company_id)
    )
  );

create policy "import_errors_insert_member"
  on public.import_errors for insert to authenticated
  with check (
    exists (
      select 1 from public.imports i
      where i.id = import_id
        and public.is_company_member(i.company_id)
    )
  );

create policy "exports_all_member"
  on public.exports for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy "company_dashboards_all_member"
  on public.company_dashboards for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy "alerts_all_member"
  on public.alerts for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy "indicator_results_all_member"
  on public.indicator_results for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy "audit_logs_select_member"
  on public.audit_logs for select to authenticated
  using (
    company_id is null
    or public.is_company_member(company_id)
  );

create policy "audit_logs_insert_authenticated"
  on public.audit_logs for insert to authenticated
  with check (
    company_id is null
    or public.is_company_member(company_id)
  );
