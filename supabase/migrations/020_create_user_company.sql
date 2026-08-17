-- Criação inicial de empresa pelo usuário autenticado (onboarding)
-- - Não gera departamentos/centros de custo automaticamente
-- - Vínculo e papel de administrador (owner) na mesma transação
-- - auth.uid() identifica o usuário; o cliente não envia user_id

alter table public.companies
  add column if not exists description text;

alter table public.company_profiles
  add column if not exists custom_segment text;

create or replace function public.normalize_cnpj(p_document text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(p_document, ''), '\D', '', 'g'), '');
$$;

create or replace function public.is_valid_cnpj(p_document text)
returns boolean
language plpgsql
immutable
as $$
declare
  v_cnpj text := public.normalize_cnpj(p_document);
  v_sum integer;
  v_d1 integer;
  v_d2 integer;
  v_w integer[];
  i integer;
begin
  if v_cnpj is null then
    return true;
  end if;

  if length(v_cnpj) <> 14 then
    return false;
  end if;

  if v_cnpj ~ '^([0-9])\1{13}$' then
    return false;
  end if;

  v_w := array[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  v_sum := 0;
  for i in 1..12 loop
    v_sum := v_sum + substring(v_cnpj from i for 1)::int * v_w[i];
  end loop;
  v_d1 := v_sum % 11;
  v_d1 := case when v_d1 < 2 then 0 else 11 - v_d1 end;
  if substring(v_cnpj from 13 for 1)::int <> v_d1 then
    return false;
  end if;

  v_w := array[6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  v_sum := 0;
  for i in 1..13 loop
    v_sum := v_sum + substring(v_cnpj from i for 1)::int * v_w[i];
  end loop;
  v_d2 := v_sum % 11;
  v_d2 := case when v_d2 < 2 then 0 else 11 - v_d2 end;

  return substring(v_cnpj from 14 for 1)::int = v_d2;
end;
$$;

-- Impede reatribuir vínculo ou auto-promover a owner
create or replace function public.protect_company_user_keys()
returns trigger
language plpgsql
as $$
begin
  if new.company_id is distinct from old.company_id then
    raise exception 'Não é permitido alterar a empresa do vínculo';
  end if;

  if new.user_id is distinct from old.user_id then
    raise exception 'Não é permitido alterar o usuário do vínculo';
  end if;

  if new.role is distinct from old.role then
    if new.role = 'owner' then
      raise exception 'Não é permitido atribuir a função de proprietário';
    end if;
    if old.role = 'owner' then
      raise exception 'Não é permitido alterar a função do proprietário';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists company_users_protect_keys on public.company_users;
create trigger company_users_protect_keys
  before update on public.company_users
  for each row execute function public.protect_company_user_keys();

-- Criação transacional: empresa + vínculo de administrador
create or replace function public.create_user_company(
  p_name text,
  p_trade_name text default null,
  p_document text default null,
  p_description text default null,
  p_segment_code text default null,
  p_custom_segment text default null
)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_company public.companies;
  v_segment_id uuid;
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_trade_name text := nullif(trim(coalesce(p_trade_name, '')), '');
  v_description text := nullif(trim(coalesce(p_description, '')), '');
  v_segment_code text := nullif(trim(coalesce(p_segment_code, '')), '');
  v_custom_segment text := nullif(trim(coalesce(p_custom_segment, '')), '');
  v_document text := public.normalize_cnpj(p_document);
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if v_name is null then
    raise exception 'Nome da empresa é obrigatório';
  end if;

  if v_segment_code is null then
    raise exception 'Segmento da empresa é obrigatório';
  end if;

  if v_document is not null and not public.is_valid_cnpj(v_document) then
    raise exception 'CNPJ inválido';
  end if;

  select s.id into v_segment_id
  from public.segments s
  where s.code = v_segment_code;

  if v_segment_id is null then
    raise exception 'Segmento da empresa é inválido';
  end if;

  insert into public.profiles (id, name, email)
  values (
    v_user_id,
    coalesce(
      (select raw_user_meta_data->>'name' from auth.users where id = v_user_id),
      'Usuário'
    ),
    (select email from auth.users where id = v_user_id)
  )
  on conflict (id) do nothing;

  insert into public.companies (name, trade_name, document, description)
  values (v_name, v_trade_name, v_document, v_description)
  returning * into v_company;

  insert into public.company_users (company_id, user_id, role)
  values (v_company.id, v_user_id, 'owner');

  insert into public.company_profiles (
    company_id,
    segment_id,
    custom_segment,
    profile_summary,
    onboarding_completed
  )
  values (
    v_company.id,
    v_segment_id,
    case when v_segment_code = 'other' then v_custom_segment else null end,
    v_description,
    false
  );

  insert into public.company_settings (company_id, settings)
  values (v_company.id, '{"locale":"pt-BR","currency":"BRL"}'::jsonb);

  insert into public.categories (company_id, name, category_type)
  values
    (v_company.id, 'Receitas Operacionais', 'revenue'),
    (v_company.id, 'Custos Diretos', 'cost'),
    (v_company.id, 'Despesas Administrativas', 'expense'),
    (v_company.id, 'Despesas Comerciais', 'expense');

  insert into public.company_features (company_id, feature_id, enabled, recommended)
  select v_company.id, sf.id, true, (sf.code in ('budget_vs_actual', 'cost_analysis'))
  from public.system_features sf
  where sf.is_active = true;

  insert into public.company_indicators (company_id, indicator_id, enabled)
  select v_company.id, si.id, true
  from public.system_indicators si
  where si.is_active = true;

  insert into public.company_reports (company_id, report_id, enabled)
  select v_company.id, sr.id, true
  from public.system_reports sr
  where sr.is_active = true;

  insert into public.company_dashboards (company_id, name, layout, theme, is_default)
  values (
    v_company.id,
    'Dashboard padrão',
    '{"widgets":["summary","budget_vs_actual","top_costs"]}'::jsonb,
    '{"accent":"navy"}'::jsonb,
    true
  );

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, new_values)
  values (
    v_company.id,
    v_user_id,
    'create',
    'company',
    v_company.id,
    jsonb_build_object(
      'name', v_company.name,
      'segment_code', v_segment_code
    )
  );

  return v_company;
end;
$$;

-- Compatibilidade: deixa de criar departamentos/centros de custo padrão
create or replace function public.create_company_with_defaults(
  p_name text,
  p_trade_name text default null,
  p_document text default null
)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.create_user_company(
    p_name,
    p_trade_name,
    p_document,
    null,
    'other',
    null
  );
end;
$$;

-- Configuração inicial (sugestões de estrutura). Exige admin da empresa.
create or replace function public.setup_company_environment(
  p_company_id uuid,
  p_name text default null,
  p_segment_code text default null,
  p_custom_segment text default null,
  p_departments text[] default '{}',
  p_cost_centers jsonb default '[]'::jsonb,
  p_skip boolean default false
)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_company public.companies;
  v_segment_id uuid;
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_segment_code text := nullif(trim(coalesce(p_segment_code, '')), '');
  v_custom_segment text := nullif(trim(coalesce(p_custom_segment, '')), '');
  v_dept text;
  v_cc jsonb;
  v_cc_name text;
  v_cc_code text;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if p_company_id is null then
    raise exception 'Empresa não informada';
  end if;

  if not public.is_company_admin(p_company_id) then
    raise exception 'Você não tem permissão para configurar esta empresa';
  end if;

  select * into v_company
  from public.companies
  where id = p_company_id;

  if v_company.id is null then
    raise exception 'Empresa não encontrada';
  end if;

  if p_skip then
    update public.company_profiles
    set onboarding_completed = true,
        updated_at = now()
    where company_id = p_company_id;

    return v_company;
  end if;

  if v_name is not null then
    update public.companies
    set name = v_name,
        updated_at = now()
    where id = p_company_id
    returning * into v_company;
  end if;

  if v_segment_code is not null then
    select s.id into v_segment_id
    from public.segments s
    where s.code = v_segment_code;

    if v_segment_id is null then
      raise exception 'Segmento da empresa é inválido';
    end if;

    update public.company_profiles
    set segment_id = v_segment_id,
        custom_segment = case
          when v_segment_code = 'other' then v_custom_segment
          else null
        end,
        updated_at = now()
    where company_id = p_company_id;
  end if;

  if p_departments is not null then
    foreach v_dept in array p_departments loop
      v_dept := nullif(trim(v_dept), '');
      if v_dept is null then
        continue;
      end if;

      insert into public.departments (company_id, name)
      select p_company_id, v_dept
      where not exists (
        select 1
        from public.departments d
        where d.company_id = p_company_id
          and lower(d.name) = lower(v_dept)
      );
    end loop;
  end if;

  if p_cost_centers is not null and jsonb_typeof(p_cost_centers) = 'array' then
    for v_cc in select value from jsonb_array_elements(p_cost_centers) loop
      v_cc_name := nullif(trim(coalesce(v_cc->>'name', '')), '');
      v_cc_code := nullif(trim(coalesce(v_cc->>'code', '')), '');
      if v_cc_name is null then
        continue;
      end if;

      insert into public.cost_centers (company_id, name, code)
      select p_company_id, v_cc_name, v_cc_code
      where not exists (
        select 1
        from public.cost_centers c
        where c.company_id = p_company_id
          and lower(c.name) = lower(v_cc_name)
      );
    end loop;
  end if;

  update public.company_profiles
  set onboarding_completed = true,
      updated_at = now()
  where company_id = p_company_id;

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, new_values)
  values (
    p_company_id,
    v_user_id,
    'update',
    'company_setup',
    p_company_id,
    jsonb_build_object('name', v_company.name, 'skipped', false)
  );

  return v_company;
end;
$$;

revoke all on function public.normalize_cnpj(text) from public;
revoke all on function public.is_valid_cnpj(text) from public;
revoke all on function public.create_user_company(text, text, text, text, text, text) from public;
revoke all on function public.setup_company_environment(uuid, text, text, text, text[], jsonb, boolean) from public;

grant execute on function public.normalize_cnpj(text) to authenticated;
grant execute on function public.is_valid_cnpj(text) to authenticated;
grant execute on function public.create_user_company(text, text, text, text, text, text) to authenticated;
grant execute on function public.setup_company_environment(uuid, text, text, text, text[], jsonb, boolean) to authenticated;

-- Empresas só nascem pela função (security definer). Evita órfãs sem vínculo.
drop policy if exists "companies_insert_authenticated" on public.companies;

-- Vínculo inicial é criado pela função. Admins convidam papéis abaixo de owner.
drop policy if exists "company_users_insert_self" on public.company_users;

drop policy if exists "company_users_insert_admin" on public.company_users;
create policy "company_users_insert_admin"
  on public.company_users for insert to authenticated
  with check (
    public.is_company_admin(company_id)
    and role in ('admin', 'member', 'viewer')
    and user_id <> auth.uid()
  );

-- Membros veem nomes dos colegas da mesma empresa (gestão de usuários)
drop policy if exists "profiles_select_same_company" on public.profiles;
create policy "profiles_select_same_company"
  on public.profiles for select to authenticated
  using (
    exists (
      select 1
      from public.company_users cu_self
      join public.company_users cu_other
        on cu_other.company_id = cu_self.company_id
      where cu_self.user_id = auth.uid()
        and cu_other.user_id = profiles.id
    )
  );
