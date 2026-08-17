-- Contas bancárias padrão com os principais bancos do mercado brasileiro.
-- Empresas novas recebem na criação; empresas já existentes são preenchidas aqui.

create or replace function public.ensure_company_default_bank_accounts(
  p_company_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if p_company_id is null then
    raise exception 'Empresa não informada';
  end if;

  if auth.uid() is not null and not public.is_company_member(p_company_id) then
    raise exception 'Sem acesso a esta empresa';
  end if;

  for r in
    select *
    from (
      values
        ('001'::text, 'Banco do Brasil'::text, 'checking'::text),
        ('003', 'Banco da Amazônia', 'checking'),
        ('004', 'Banco do Nordeste', 'checking'),
        ('033', 'Santander', 'checking'),
        ('041', 'Banrisul', 'checking'),
        ('077', 'Inter', 'checking'),
        ('104', 'Caixa Econômica Federal', 'checking'),
        ('197', 'Stone', 'payment'),
        ('208', 'BTG Pactual', 'checking'),
        ('212', 'Banco Original', 'checking'),
        ('237', 'Bradesco', 'checking'),
        ('260', 'Nubank', 'checking'),
        ('290', 'PagBank', 'payment'),
        ('323', 'Mercado Pago', 'payment'),
        ('336', 'C6 Bank', 'checking'),
        ('341', 'Itaú', 'checking'),
        ('380', 'PicPay', 'payment'),
        ('422', 'Safra', 'checking'),
        ('623', 'Banco Pan', 'checking'),
        ('748', 'Sicredi', 'checking'),
        ('756', 'Sicoob', 'checking')
    ) as t(bank_code, bank_name, account_type)
  loop
    if exists (
      select 1
      from public.bank_accounts a
      where a.company_id = p_company_id
        and (
          a.bank_code = r.bank_code
          or lower(a.name) = lower(r.bank_name)
          or lower(coalesce(a.bank_name, '')) = lower(r.bank_name)
        )
    ) then
      continue;
    end if;

    insert into public.bank_accounts (
      company_id,
      name,
      bank_code,
      bank_name,
      account_type
    )
    values (
      p_company_id,
      r.bank_name,
      r.bank_code,
      r.bank_name,
      r.account_type
    );
  end loop;
end;
$$;

revoke all on function public.ensure_company_default_bank_accounts(uuid) from public;
grant execute on function public.ensure_company_default_bank_accounts(uuid) to authenticated;

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

  perform public.ensure_company_default_departments(v_company.id);
  perform public.ensure_company_default_bank_accounts(v_company.id);

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

do $$
declare
  v_company_id uuid;
begin
  for v_company_id in select id from public.companies loop
    perform public.ensure_company_default_bank_accounts(v_company_id);
  end loop;
end;
$$;
