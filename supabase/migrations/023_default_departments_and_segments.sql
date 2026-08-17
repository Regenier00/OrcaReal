-- Segmentos do cadastro de empresa e departamentos padrão na criação.

insert into public.segments (code, name, description) values
  ('agro', 'Agricultura e Agronegócio', 'Agricultura, agronegócio e correlatos'),
  ('livestock', 'Pecuária', 'Criação animal e pecuária'),
  ('fishing', 'Pesca e Aquicultura', 'Pesca, piscicultura e aquicultura'),
  ('commerce', 'Comércio', 'Varejo e atacado'),
  ('industry', 'Indústria', 'Produção e manufatura'),
  ('construction', 'Construção Civil', 'Obras, engenharia e construção'),
  ('services', 'Serviços', 'Prestação de serviços em geral'),
  ('tech', 'Tecnologia e Informática', 'Software, TI e tecnologia'),
  ('transport_logistics', 'Transporte e Logística', 'Transporte, armazenagem e distribuição'),
  ('food', 'Alimentação', 'Alimentos e bebidas'),
  ('hospitality', 'Hotelaria e Turismo', 'Hotéis, turismo e hospitalidade'),
  ('health', 'Saúde', 'Saúde e cuidados médicos'),
  ('education', 'Educação', 'Educação e ensino'),
  ('real_estate', 'Imobiliário', 'Imóveis e administração predial'),
  ('financial', 'Serviços Financeiros', 'Bancos, seguros e serviços financeiros'),
  ('automotive', 'Automotivo', 'Veículos, peças e serviços automotivos'),
  ('energy', 'Energia', 'Geração, distribuição e energia'),
  ('mining', 'Mineração', 'Extração mineral'),
  ('media', 'Comunicação e Mídia', 'Comunicação, imprensa e mídia'),
  ('marketing', 'Marketing e Publicidade', 'Marketing, publicidade e propaganda'),
  ('entertainment', 'Entretenimento e Cultura', 'Cultura, lazer e entretenimento'),
  ('sports', 'Esporte e Lazer', 'Esporte, recreação e lazer'),
  ('beauty', 'Beleza e Estética', 'Beleza, estética e cuidados pessoais'),
  ('professional', 'Serviços Profissionais', 'Consultoria, advocacia e serviços especializados'),
  ('environment', 'Meio Ambiente', 'Meio ambiente e sustentabilidade'),
  ('public_admin', 'Administração Pública', 'Órgãos e administração pública'),
  ('other', 'Outros', 'Outros ramos de atividade')
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description;

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

  insert into public.departments (company_id, name, description)
  values
    (v_company.id, 'Administração Geral', 'Administrativo'),
    (v_company.id, 'Gestão Financeira', 'Financeiro'),
    (v_company.id, 'Contabilidade', 'Contabilidade'),
    (v_company.id, 'Recursos Humanos', 'Recursos Humanos'),
    (v_company.id, 'Vendas e Comercial', 'Comercial / Vendas'),
    (v_company.id, 'Marketing', 'Marketing'),
    (v_company.id, 'Compras', 'Compras'),
    (v_company.id, 'Estoque e Almoxarifado', 'Estoque / Almoxarifado'),
    (v_company.id, 'Operações e Produção', 'Operacional / Produção'),
    (v_company.id, 'Logística e Distribuição', 'Logística');

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
