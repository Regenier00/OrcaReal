-- Motor de inteligência setorial: fontes externas, conhecimento por ramo,
-- benchmarks normalizados e perfil econômico progressivo da empresa.
-- Regras de seleção de fontes e montagem do perfil ficam no banco (security definer).

-- ---------------------------------------------------------------------------
-- Catálogo de fontes externas confiáveis
-- ---------------------------------------------------------------------------

create table if not exists public.sector_data_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  organization text not null,
  url text,
  description text,
  coverage_notes text,
  reliability_tier smallint not null default 1
    check (reliability_tier between 1 and 3),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.segment_data_sources (
  id uuid primary key default gen_random_uuid(),
  segment_code text not null references public.segments (code) on delete cascade,
  source_id uuid not null references public.sector_data_sources (id) on delete cascade,
  priority integer not null default 100,
  relevance_notes text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (segment_code, source_id)
);

create index if not exists segment_data_sources_segment_idx
  on public.segment_data_sources (segment_code, priority);

-- ---------------------------------------------------------------------------
-- Conhecimento setorial (atividades, produtos, receitas, custos, etc.)
-- ---------------------------------------------------------------------------

create table if not exists public.sector_knowledge_items (
  id uuid primary key default gen_random_uuid(),
  segment_code text not null references public.segments (code) on delete cascade,
  kind text not null
    check (kind in (
      'subramo',
      'activity',
      'product',
      'revenue',
      'cost',
      'expense',
      'indicator',
      'benchmark_metric'
    )),
  code text not null,
  name text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  source_id uuid references public.sector_data_sources (id) on delete set null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (segment_code, kind, code)
);

create index if not exists sector_knowledge_items_segment_kind_idx
  on public.sector_knowledge_items (segment_code, kind)
  where is_active;

-- ---------------------------------------------------------------------------
-- Benchmarks externos normalizados (somente dados com fonte; nunca inventados)
-- ---------------------------------------------------------------------------

create table if not exists public.sector_benchmarks (
  id uuid primary key default gen_random_uuid(),
  segment_code text not null references public.segments (code) on delete cascade,
  subramo_code text,
  metric_code text not null,
  metric_name text not null,
  geography text not null default 'BR',
  period_label text,
  period_start date,
  period_end date,
  value_numeric numeric(24, 6),
  value_text text,
  unit text,
  sample_notes text,
  source_id uuid not null references public.sector_data_sources (id) on delete restrict,
  external_ref text,
  raw_payload jsonb not null default '{}'::jsonb,
  fetched_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    value_numeric is not null
    or nullif(trim(coalesce(value_text, '')), '') is not null
  )
);

create index if not exists sector_benchmarks_segment_idx
  on public.sector_benchmarks (segment_code, metric_code)
  where is_active;

-- ---------------------------------------------------------------------------
-- Perfil econômico da empresa + fontes selecionadas
-- ---------------------------------------------------------------------------

create table if not exists public.company_economic_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies (id) on delete cascade,
  segment_code text references public.segments (code) on delete set null,
  subramo text,
  activity text,
  location_state text,
  location_city text,
  company_size text,
  products_services text[],
  revenue_model text,
  operation_model text,
  business_model_summary text,
  profile_snapshot jsonb not null default '{}'::jsonb,
  knowledge_snapshot jsonb not null default '{}'::jsonb,
  selected_source_codes text[] not null default '{}',
  refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_sector_sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  source_id uuid not null references public.sector_data_sources (id) on delete cascade,
  segment_code text not null,
  priority integer not null default 100,
  selection_reason text not null default 'segment_match',
  is_active boolean not null default true,
  selected_at timestamptz not null default now(),
  unique (company_id, source_id)
);

create index if not exists company_sector_sources_company_idx
  on public.company_sector_sources (company_id)
  where is_active;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.sector_data_sources enable row level security;
alter table public.segment_data_sources enable row level security;
alter table public.sector_knowledge_items enable row level security;
alter table public.sector_benchmarks enable row level security;
alter table public.company_economic_profiles enable row level security;
alter table public.company_sector_sources enable row level security;

create policy "sector_data_sources_select_authenticated"
  on public.sector_data_sources for select to authenticated
  using (is_active = true);

create policy "segment_data_sources_select_authenticated"
  on public.segment_data_sources for select to authenticated
  using (true);

create policy "sector_knowledge_items_select_authenticated"
  on public.sector_knowledge_items for select to authenticated
  using (is_active = true);

create policy "sector_benchmarks_select_authenticated"
  on public.sector_benchmarks for select to authenticated
  using (is_active = true);

create policy "company_economic_profiles_select_member"
  on public.company_economic_profiles for select to authenticated
  using (public.is_company_member(company_id));

create policy "company_sector_sources_select_member"
  on public.company_sector_sources for select to authenticated
  using (public.is_company_member(company_id));

-- Escritas apenas via RPCs security definer (sem policies de insert/update para authenticated)

-- ---------------------------------------------------------------------------
-- Seed: fontes externas
-- ---------------------------------------------------------------------------

insert into public.sector_data_sources (code, name, organization, url, description, reliability_tier) values
  ('cna_brasil', 'CNA Brasil', 'Confederação da Agricultura e Pecuária do Brasil', 'https://www.cnabrasil.org.br', 'Dados e análises do agronegócio brasileiro', 1),
  ('conab', 'CONAB', 'Companhia Nacional de Abastecimento', 'https://www.conab.gov.br', 'Safras, estoques e abastecimento agrícola', 1),
  ('ibge', 'IBGE', 'Instituto Brasileiro de Geografia e Estatística', 'https://www.ibge.gov.br', 'Estatísticas oficiais demográficas e econômicas', 1),
  ('embrapa', 'Embrapa', 'Empresa Brasileira de Pesquisa Agropecuária', 'https://www.embrapa.br', 'Pesquisa e conhecimento agropecuário', 1),
  ('cepea', 'CEPEA', 'Centro de Estudos Avançados em Economia Aplicada', 'https://www.cepea.esalq.usp.br', 'Indicadores de preços e custos do agronegócio', 1),
  ('peixe_br', 'Peixe BR', 'Associação Brasileira da Piscicultura', 'https://www.peixebr.com.br', 'Dados do setor de piscicultura', 2),
  ('sebrae_intel', 'Sebrae Inteligência de Mercado', 'Sebrae', 'https://www.sebrae.com.br', 'Inteligência de mercado para pequenos negócios', 1),
  ('mapa_empresas', 'Mapa de Empresas', 'Governo Federal', 'https://www.gov.br/empresas-e-negocios', 'Panorama de empresas formais no Brasil', 1),
  ('cni', 'CNI', 'Confederação Nacional da Indústria', 'https://www.portaldaindustria.com.br', 'Indicadores e pesquisas industriais', 1),
  ('assoc_industriais', 'Associações industriais', 'Associações setoriais', null, 'Associações e sindicatos industriais por subramo', 3),
  ('cbic', 'CBIC', 'Câmara Brasileira da Indústria da Construção', 'https://cbic.org.br', 'Dados da construção civil', 1),
  ('brasscom', 'Brasscom', 'Associação das Empresas de Tecnologia da Informação e Comunicação', 'https://brasscom.org.br', 'Dados do setor de TIC', 1),
  ('abes', 'ABES', 'Associação Brasileira das Empresas de Software', 'https://www.abes.org.br', 'Mercado de software e serviços de TI', 1),
  ('antt', 'ANTT', 'Agência Nacional de Transportes Terrestres', 'https://www.gov.br/antt', 'Regulação e dados de transporte terrestre', 1),
  ('cnt', 'CNT', 'Confederação Nacional do Transporte', 'https://www.cnt.org.br', 'Pesquisas e indicadores do transporte', 1),
  ('abia', 'ABIA', 'Associação Brasileira da Indústria de Alimentos', 'https://www.abia.org.br', 'Dados da indústria de alimentos', 2),
  ('min_turismo', 'Ministério do Turismo', 'Ministério do Turismo', 'https://www.gov.br/turismo', 'Políticas e dados de turismo', 1),
  ('embratur', 'Embratur', 'Agência Brasileira de Promoção Internacional do Turismo', 'https://www.embratur.com.br', 'Promoção e inteligência de turismo', 2),
  ('ans', 'ANS', 'Agência Nacional de Saúde Suplementar', 'https://www.gov.br/ans', 'Dados da saúde suplementar', 1),
  ('min_saude', 'Ministério da Saúde', 'Ministério da Saúde', 'https://www.gov.br/saude', 'Dados e políticas de saúde', 1),
  ('inep', 'INEP', 'Instituto Nacional de Estudos e Pesquisas Educacionais', 'https://www.gov.br/inep', 'Indicadores educacionais', 1),
  ('mec', 'Ministério da Educação', 'Ministério da Educação', 'https://www.gov.br/mec', 'Políticas e dados da educação', 1),
  ('secovi', 'Secovi', 'Sindicato da Habitação', 'https://www.secovi.com.br', 'Mercado imobiliário', 2),
  ('banco_central', 'Banco Central', 'Banco Central do Brasil', 'https://www.bcb.gov.br', 'Sistema financeiro e indicadores monetários', 1),
  ('cvm', 'CVM', 'Comissão de Valores Mobiliários', 'https://www.gov.br/cvm', 'Mercado de capitais', 1),
  ('anfavea', 'Anfavea', 'Associação Nacional dos Fabricantes de Veículos Automotores', 'https://anfavea.com.br', 'Produção e vendas de veículos', 1),
  ('fenabrave', 'Fenabrave', 'Federação Nacional da Distribuição de Veículos Automotores', 'https://www.fenabrave.org.br', 'Distribuição e varejo automotivo', 1),
  ('aneel', 'ANEEL', 'Agência Nacional de Energia Elétrica', 'https://www.gov.br/aneel', 'Regulação e dados do setor elétrico', 1),
  ('epe', 'EPE', 'Empresa de Pesquisa Energética', 'https://www.epe.gov.br', 'Planejamento e estudos energéticos', 1),
  ('anm', 'ANM', 'Agência Nacional de Mineração', 'https://www.gov.br/anm', 'Regulação e dados minerários', 1),
  ('ibram', 'IBRAM', 'Instituto Brasileiro de Mineração', 'https://ibram.org.br', 'Dados do setor mineral', 2),
  ('secom', 'Secretaria de Comunicação', 'Secretaria de Comunicação Social', 'https://www.gov.br/secom', 'Comunicação pública e mídia', 2),
  ('assoc_midia', 'Associações de mídia', 'Associações do setor de comunicação', null, 'Associações de comunicação e mídia', 3),
  ('iab_brasil', 'IAB Brasil', 'Interactive Advertising Bureau Brasil', 'https://iabbrasil.com.br', 'Publicidade digital', 2),
  ('cenp', 'CENP', 'Conselho Executivo das Normas-Padrão', 'https://www.cenp.com.br', 'Normas e mercado publicitário', 2),
  ('min_cultura', 'Ministério da Cultura', 'Ministério da Cultura', 'https://www.gov.br/cultura', 'Políticas e dados culturais', 1),
  ('assoc_esporte', 'Associações esportivas', 'Associações do esporte', null, 'Associações e federações esportivas', 3),
  ('abihpec', 'ABIHPEC', 'Associação Brasileira da Indústria de Higiene Pessoal, Perfumaria e Cosméticos', 'https://abihpec.org.br', 'Beleza, higiene e cosméticos', 2),
  ('conselhos_prof', 'Conselhos profissionais', 'Conselhos de classe', null, 'Conselhos e ordens profissionais', 3),
  ('ibama', 'IBAMA', 'Instituto Brasileiro do Meio Ambiente e dos Recursos Naturais Renováveis', 'https://www.gov.br/ibama', 'Licenciamento e meio ambiente', 1),
  ('ana', 'ANA', 'Agência Nacional de Águas e Saneamento Básico', 'https://www.gov.br/ana', 'Recursos hídricos e saneamento', 1),
  ('portal_transparencia', 'Portal da Transparência', 'Controladoria-Geral da União', 'https://portaldatransparencia.gov.br', 'Despesas e dados da administração pública', 1),
  ('tesouro_nacional', 'Tesouro Nacional', 'Secretaria do Tesouro Nacional', 'https://www.tesourotransparente.gov.br', 'Finanças públicas', 1),
  ('sebrae', 'Sebrae', 'Sebrae', 'https://www.sebrae.com.br', 'Apoio e dados para pequenos negócios', 1),
  ('fontes_especificas', 'Fontes específicas da atividade', 'Diversas', null, 'Fontes setoriais conforme a atividade econômica informada', 3)
on conflict (code) do update set
  name = excluded.name,
  organization = excluded.organization,
  url = excluded.url,
  description = excluded.description,
  reliability_tier = excluded.reliability_tier,
  is_active = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Mapeamento segmento → fontes (somente as relevantes; sem buscar tudo)
-- ---------------------------------------------------------------------------

create or replace function public._seed_segment_sources(
  p_segment text,
  p_sources text[],
  p_primary text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_source_id uuid;
  v_prio integer := 10;
begin
  foreach v_code in array p_sources loop
    select id into v_source_id from public.sector_data_sources where code = v_code;
    if v_source_id is null then
      continue;
    end if;
    insert into public.segment_data_sources (segment_code, source_id, priority, is_primary)
    values (p_segment, v_source_id, v_prio, (p_primary is not null and v_code = p_primary))
    on conflict (segment_code, source_id) do update
    set priority = excluded.priority,
        is_primary = excluded.is_primary;
    v_prio := v_prio + 10;
  end loop;
end;
$$;

select public._seed_segment_sources('agro', array['cna_brasil', 'conab', 'ibge', 'embrapa', 'cepea'], 'cna_brasil');
select public._seed_segment_sources('livestock', array['cna_brasil', 'ibge', 'embrapa', 'cepea'], 'cna_brasil');
select public._seed_segment_sources('fishing', array['peixe_br', 'ibge', 'embrapa'], 'peixe_br');
select public._seed_segment_sources('commerce', array['sebrae_intel', 'ibge', 'mapa_empresas'], 'sebrae_intel');
select public._seed_segment_sources('industry', array['ibge', 'cni', 'assoc_industriais'], 'ibge');
select public._seed_segment_sources('construction', array['ibge', 'cbic', 'sebrae'], 'cbic');
select public._seed_segment_sources('services', array['ibge', 'sebrae'], 'ibge');
select public._seed_segment_sources('tech', array['brasscom', 'abes', 'ibge'], 'brasscom');
select public._seed_segment_sources('transport_logistics', array['antt', 'cnt', 'ibge'], 'antt');
select public._seed_segment_sources('food', array['abia', 'sebrae', 'ibge'], 'abia');
select public._seed_segment_sources('hospitality', array['min_turismo', 'embratur', 'ibge'], 'min_turismo');
select public._seed_segment_sources('health', array['ans', 'min_saude', 'ibge'], 'ans');
select public._seed_segment_sources('education', array['inep', 'mec', 'sebrae'], 'inep');
select public._seed_segment_sources('real_estate', array['cbic', 'ibge', 'secovi'], 'secovi');
select public._seed_segment_sources('financial', array['banco_central', 'cvm', 'ibge'], 'banco_central');
select public._seed_segment_sources('automotive', array['anfavea', 'fenabrave', 'ibge'], 'anfavea');
select public._seed_segment_sources('energy', array['aneel', 'epe', 'ibge'], 'aneel');
select public._seed_segment_sources('mining', array['anm', 'ibram', 'ibge'], 'anm');
select public._seed_segment_sources('media', array['ibge', 'secom', 'assoc_midia'], 'ibge');
select public._seed_segment_sources('marketing', array['iab_brasil', 'cenp', 'sebrae'], 'iab_brasil');
select public._seed_segment_sources('entertainment', array['ibge', 'min_cultura'], 'ibge');
select public._seed_segment_sources('sports', array['ibge', 'sebrae', 'assoc_esporte'], 'ibge');
select public._seed_segment_sources('beauty', array['abihpec', 'sebrae', 'ibge'], 'abihpec');
select public._seed_segment_sources('professional', array['sebrae', 'ibge', 'conselhos_prof'], 'sebrae');
select public._seed_segment_sources('environment', array['ibama', 'ana', 'ibge'], 'ibama');
select public._seed_segment_sources('public_admin', array['portal_transparencia', 'tesouro_nacional', 'ibge'], 'portal_transparencia');
select public._seed_segment_sources('other', array['ibge', 'sebrae', 'fontes_especificas'], 'ibge');

drop function if exists public._seed_segment_sources(text, text[], text);

-- ---------------------------------------------------------------------------
-- Helpers de interpretação do perfil (sem inventar números)
-- ---------------------------------------------------------------------------

create or replace function public._json_fact_to_text_array(p_facts jsonb, p_key text)
returns text[]
language plpgsql
immutable
as $$
declare
  v_node jsonb;
  v_text text;
  v_result text[];
begin
  v_node := p_facts -> p_key;
  if v_node is null or v_node = 'null'::jsonb then
    return '{}'::text[];
  end if;

  if jsonb_typeof(v_node) = 'array' then
    select coalesce(array_agg(trim(value #>> '{}')), '{}')
    into v_result
    from jsonb_array_elements(v_node)
    where nullif(trim(value #>> '{}'), '') is not null;
    return coalesce(v_result, '{}'::text[]);
  end if;

  v_text := nullif(trim(v_node #>> '{}'), '');
  if v_text is null then
    return '{}'::text[];
  end if;

  select coalesce(array_agg(trim(part)), '{}')
  into v_result
  from unnest(string_to_array(v_text, ',')) as part
  where nullif(trim(part), '') is not null;

  return coalesce(v_result, '{}'::text[]);
end;
$$;

create or replace function public._economic_products_from_facts(p_facts jsonb)
returns text[]
language sql
immutable
as $$
  select coalesce(
    (
      select array_agg(distinct trim(v) order by trim(v))
      from (
        select unnest(public._json_fact_to_text_array(p_facts, 'products_sold')) as v
        union all
        select unnest(public._json_fact_to_text_array(p_facts, 'manufactured_products'))
        union all
        select unnest(public._json_fact_to_text_array(p_facts, 'food_products'))
        union all
        select unnest(public._json_fact_to_text_array(p_facts, 'tech_products'))
        union all
        select unnest(public._json_fact_to_text_array(p_facts, 'service_type'))
        union all
        select unnest(public._json_fact_to_text_array(p_facts, 'beauty_services'))
        union all
        select unnest(public._json_fact_to_text_array(p_facts, 'auto_services'))
        union all
        select unnest(public._json_fact_to_text_array(p_facts, 'extra_services'))
        union all
        select unnest(public._json_fact_to_text_array(p_facts, 'crops'))
      ) q
      where nullif(trim(v), '') is not null
    ),
    '{}'::text[]
  );
$$;

create or replace function public._economic_subramo_from_facts(p_facts jsonb)
returns text
language sql
immutable
as $$
  select nullif(trim(coalesce(
    p_facts->>'industry_type',
    p_facts->>'livestock_type',
    p_facts->>'fishing_type',
    p_facts->>'food_type',
    p_facts->>'tech_type',
    p_facts->>'health_type',
    p_facts->>'education_type',
    p_facts->>'auto_type',
    p_facts->>'energy_type',
    p_facts->>'entertainment_type',
    p_facts->>'sports_type',
    p_facts->>'environment_type',
    p_facts->>'financial_type',
    p_facts->>'professional_type',
    p_facts->>'work_type',
    p_facts->>'vehicle_type',
    p_facts->>'real_estate_model',
    p_facts->>'public_type',
    p_facts->>'other_activity',
    case
      when jsonb_typeof(p_facts->'crops') = 'array' and jsonb_array_length(p_facts->'crops') > 0
        then p_facts->'crops'->>0
      else null
    end,
    ''
  )), '');
$$;

create or replace function public._economic_activity_from_facts(p_facts jsonb, p_primary_activity text)
returns text
language sql
immutable
as $$
  select nullif(trim(coalesce(
    nullif(trim(coalesce(p_primary_activity, '')), ''),
    p_facts->>'service_type',
    p_facts->>'other_activity',
    p_facts->>'mineral_type',
    ''
  )), '');
$$;

-- ---------------------------------------------------------------------------
-- RPC: monta/atualiza inteligência setorial da empresa
-- ---------------------------------------------------------------------------

create or replace function public.refresh_company_sector_intelligence(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.company_profiles%rowtype;
  v_segment_code text;
  v_extra_codes text[] := '{}';
  v_all_codes text[] := '{}';
  v_facts jsonb := '{}'::jsonb;
  v_products text[] := '{}';
  v_subramo text;
  v_activity text;
  v_knowledge jsonb := '{}'::jsonb;
  v_sources jsonb := '[]'::jsonb;
  v_benchmarks jsonb := '[]'::jsonb;
  v_source_codes text[] := '{}';
  v_business_summary text;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not public.is_company_member(p_company_id) then
    raise exception 'Você não tem acesso a esta empresa';
  end if;

  select * into v_profile
  from public.company_profiles
  where company_id = p_company_id;

  if v_profile.id is null then
    raise exception 'Perfil da empresa não encontrado';
  end if;

  select s.code into v_segment_code
  from public.segments s
  where s.id = v_profile.segment_id;

  if v_segment_code is null then
    raise exception 'Segmento da empresa não definido';
  end if;

  v_facts := coalesce(v_profile.profile_facts, '{}'::jsonb);

  select coalesce(array_agg(distinct s.code), '{}')
  into v_extra_codes
  from public.company_operations op
  join public.segments s on s.id = op.segment_id
  where op.company_id = p_company_id
    and op.is_primary = false
    and s.code is not null
    and s.code <> v_segment_code;

  v_all_codes := array[v_segment_code] || coalesce(v_extra_codes, '{}');

  v_products := public._economic_products_from_facts(v_facts);
  v_subramo := public._economic_subramo_from_facts(v_facts);
  v_activity := public._economic_activity_from_facts(v_facts, v_profile.primary_activity);

  -- Seleciona apenas fontes dos segmentos da empresa (sem varrer todos os sites)
  delete from public.company_sector_sources where company_id = p_company_id;

  insert into public.company_sector_sources (
    company_id, source_id, segment_code, priority, selection_reason, is_active
  )
  select distinct on (sds.source_id)
    p_company_id,
    sds.source_id,
    sds.segment_code,
    sds.priority,
    case
      when sds.segment_code = v_segment_code then 'primary_segment'
      else 'extra_operation'
    end,
    true
  from public.segment_data_sources sds
  join public.sector_data_sources src on src.id = sds.source_id and src.is_active
  where sds.segment_code = any (v_all_codes)
  order by sds.source_id, sds.priority asc, (sds.segment_code = v_segment_code) desc;

  select coalesce(array_agg(src.code order by css.priority), '{}')
  into v_source_codes
  from public.company_sector_sources css
  join public.sector_data_sources src on src.id = css.source_id
  where css.company_id = p_company_id and css.is_active;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'code', src.code,
      'name', src.name,
      'organization', src.organization,
      'url', src.url,
      'segment_code', css.segment_code,
      'priority', css.priority,
      'selection_reason', css.selection_reason,
      'reliability_tier', src.reliability_tier
    )
    order by css.priority, src.name
  ), '[]'::jsonb)
  into v_sources
  from public.company_sector_sources css
  join public.sector_data_sources src on src.id = css.source_id
  where css.company_id = p_company_id and css.is_active;

  -- Conhecimento estrutural do(s) ramo(s); não gera benchmarks fictícios
  select coalesce(jsonb_object_agg(kind, items), '{}'::jsonb)
  into v_knowledge
  from (
    select
      ski.kind,
      jsonb_agg(
        jsonb_build_object(
          'code', ski.code,
          'name', ski.name,
          'description', ski.description,
          'segment_code', ski.segment_code,
          'metadata', ski.metadata,
          'source_code', src.code
        )
        order by ski.sort_order, ski.name
      ) as items
    from public.sector_knowledge_items ski
    left join public.sector_data_sources src on src.id = ski.source_id
    where ski.is_active
      and ski.segment_code = any (v_all_codes)
    group by ski.kind
  ) grouped;

  -- Benchmarks somente se existirem no banco com fonte (nunca inventados aqui)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'metric_code', sb.metric_code,
      'metric_name', sb.metric_name,
      'segment_code', sb.segment_code,
      'subramo_code', sb.subramo_code,
      'geography', sb.geography,
      'period_label', sb.period_label,
      'value_numeric', sb.value_numeric,
      'value_text', sb.value_text,
      'unit', sb.unit,
      'sample_notes', sb.sample_notes,
      'source_code', src.code,
      'source_name', src.name,
      'external_ref', sb.external_ref,
      'fetched_at', sb.fetched_at
    )
    order by sb.metric_name
  ), '[]'::jsonb)
  into v_benchmarks
  from public.sector_benchmarks sb
  join public.sector_data_sources src on src.id = sb.source_id
  where sb.is_active
    and sb.segment_code = any (v_all_codes)
    and (
      sb.subramo_code is null
      or v_subramo is null
      or lower(sb.subramo_code) = lower(v_subramo)
    );

  v_business_summary := nullif(trim(concat_ws(
    ' · ',
    case when v_profile.revenue_model is not null then 'Receita: ' || v_profile.revenue_model end,
    case when v_profile.operation_model is not null then 'Operação: ' || v_profile.operation_model end,
    case when v_facts ? 'sales_channel' then 'Canais: ' || (v_facts->>'sales_channel') end,
    case when v_facts ? 'delivery_model' then 'Entrega: ' || (v_facts->>'delivery_model') end
  )), '');

  insert into public.company_economic_profiles (
    company_id,
    segment_code,
    subramo,
    activity,
    location_state,
    location_city,
    company_size,
    products_services,
    revenue_model,
    operation_model,
    business_model_summary,
    profile_snapshot,
    knowledge_snapshot,
    selected_source_codes,
    refreshed_at,
    updated_at
  )
  values (
    p_company_id,
    v_segment_code,
    v_subramo,
    v_activity,
    v_profile.state,
    v_profile.city,
    v_profile.company_size,
    v_products,
    v_profile.revenue_model,
    v_profile.operation_model,
    v_business_summary,
    jsonb_build_object(
      'segment_code', v_segment_code,
      'extra_segments', to_jsonb(coalesce(v_extra_codes, '{}')),
      'subramo', v_subramo,
      'activity', v_activity,
      'company_size', v_profile.company_size,
      'employee_count', v_profile.employee_count,
      'state', v_profile.state,
      'city', v_profile.city,
      'revenue_model', v_profile.revenue_model,
      'operation_model', v_profile.operation_model,
      'products_services', to_jsonb(v_products),
      'profile_facts', v_facts,
      'custom_segment', v_profile.custom_segment
    ),
    v_knowledge,
    coalesce(v_source_codes, '{}'),
    now(),
    now()
  )
  on conflict (company_id) do update set
    segment_code = excluded.segment_code,
    subramo = excluded.subramo,
    activity = excluded.activity,
    location_state = excluded.location_state,
    location_city = excluded.location_city,
    company_size = excluded.company_size,
    products_services = excluded.products_services,
    revenue_model = excluded.revenue_model,
    operation_model = excluded.operation_model,
    business_model_summary = excluded.business_model_summary,
    profile_snapshot = excluded.profile_snapshot,
    knowledge_snapshot = excluded.knowledge_snapshot,
    selected_source_codes = excluded.selected_source_codes,
    refreshed_at = now(),
    updated_at = now();

  return jsonb_build_object(
    'company_id', p_company_id,
    'segment_code', v_segment_code,
    'extra_segments', coalesce(v_extra_codes, '{}'),
    'subramo', v_subramo,
    'activity', v_activity,
    'location_state', v_profile.state,
    'location_city', v_profile.city,
    'company_size', v_profile.company_size,
    'products_services', coalesce(v_products, '{}'),
    'revenue_model', v_profile.revenue_model,
    'operation_model', v_profile.operation_model,
    'business_model_summary', v_business_summary,
    'selected_sources', v_sources,
    'knowledge', v_knowledge,
    'benchmarks', v_benchmarks,
    'benchmarks_available', jsonb_array_length(v_benchmarks) > 0,
    'refreshed_at', now()
  );
end;
$$;

create or replace function public.get_company_sector_intelligence(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.company_economic_profiles%rowtype;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;
  if not public.is_company_member(p_company_id) then
    raise exception 'Você não tem acesso a esta empresa';
  end if;

  select * into v_profile
  from public.company_economic_profiles
  where company_id = p_company_id;

  if v_profile.id is null then
    return public.refresh_company_sector_intelligence(p_company_id);
  end if;

  -- Reutiliza snapshot; benchmarks sempre lidos ao vivo do banco (somente com fonte)
  select jsonb_build_object(
    'company_id', p_company_id,
    'segment_code', v_profile.segment_code,
    'extra_segments', coalesce(v_profile.profile_snapshot->'extra_segments', '[]'::jsonb),
    'subramo', v_profile.subramo,
    'activity', v_profile.activity,
    'location_state', v_profile.location_state,
    'location_city', v_profile.location_city,
    'company_size', v_profile.company_size,
    'products_services', to_jsonb(coalesce(v_profile.products_services, '{}')),
    'revenue_model', v_profile.revenue_model,
    'operation_model', v_profile.operation_model,
    'business_model_summary', v_profile.business_model_summary,
    'selected_sources', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'code', src.code,
          'name', src.name,
          'organization', src.organization,
          'url', src.url,
          'segment_code', css.segment_code,
          'priority', css.priority,
          'selection_reason', css.selection_reason,
          'reliability_tier', src.reliability_tier
        )
        order by css.priority, src.name
      )
      from public.company_sector_sources css
      join public.sector_data_sources src on src.id = css.source_id
      where css.company_id = p_company_id and css.is_active
    ), '[]'::jsonb),
    'knowledge', coalesce(v_profile.knowledge_snapshot, '{}'::jsonb),
    'benchmarks', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'metric_code', sb.metric_code,
          'metric_name', sb.metric_name,
          'segment_code', sb.segment_code,
          'subramo_code', sb.subramo_code,
          'geography', sb.geography,
          'period_label', sb.period_label,
          'value_numeric', sb.value_numeric,
          'value_text', sb.value_text,
          'unit', sb.unit,
          'sample_notes', sb.sample_notes,
          'source_code', src.code,
          'source_name', src.name,
          'external_ref', sb.external_ref,
          'fetched_at', sb.fetched_at
        )
        order by sb.metric_name
      )
      from public.sector_benchmarks sb
      join public.sector_data_sources src on src.id = sb.source_id
      where sb.is_active
        and sb.segment_code = v_profile.segment_code
        and (
          sb.subramo_code is null
          or v_profile.subramo is null
          or lower(sb.subramo_code) = lower(v_profile.subramo)
        )
    ), '[]'::jsonb),
    'benchmarks_available', exists (
      select 1 from public.sector_benchmarks sb
      where sb.is_active and sb.segment_code = v_profile.segment_code
    ),
    'refreshed_at', v_profile.refreshed_at
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.refresh_company_sector_intelligence(uuid) from public;
revoke all on function public.get_company_sector_intelligence(uuid) from public;
grant execute on function public.refresh_company_sector_intelligence(uuid) to authenticated;
grant execute on function public.get_company_sector_intelligence(uuid) to authenticated;
