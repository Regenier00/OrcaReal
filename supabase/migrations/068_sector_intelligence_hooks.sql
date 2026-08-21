-- Integra o motor setorial ao ciclo de vida do cadastro e reativa perguntas
-- de produtos/serviços necessárias ao perfil econômico.

-- ---------------------------------------------------------------------------
-- Dispara inteligência setorial quando o perfil econômico muda
-- ---------------------------------------------------------------------------

create or replace function public.company_profiles_refresh_sector_intelligence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.segment_id is null then
    return new;
  end if;

  -- Só membros autenticados montam inteligência (criação e questionário)
  if auth.uid() is null then
    return new;
  end if;

  perform public.refresh_company_sector_intelligence(new.company_id);
  return new;
exception
  when others then
    -- Não bloqueia o cadastro se o catálogo setorial ainda estiver incompleto
    raise warning 'sector_intelligence_refresh_failed: %', sqlerrm;
    return new;
end;
$$;

drop trigger if exists company_profiles_sector_intelligence_trg on public.company_profiles;

create trigger company_profiles_sector_intelligence_trg
  after insert or update of
    segment_id,
    custom_segment,
    company_size,
    state,
    city,
    operation_model,
    revenue_model,
    primary_activity,
    profile_facts,
    employee_count
  on public.company_profiles
  for each row
  execute function public.company_profiles_refresh_sector_intelligence();

create or replace function public.add_company_operation(
  p_company_id uuid,
  p_segment_code text,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_segment_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;
  if not public.is_company_admin(p_company_id) then
    raise exception 'Você não tem permissão para configurar esta empresa';
  end if;

  select id into v_segment_id from public.segments where code = p_segment_code;
  if v_segment_id is null then
    raise exception 'Ramo inválido';
  end if;

  insert into public.company_operations (company_id, segment_id, name, is_primary)
  values (p_company_id, v_segment_id, coalesce(nullif(trim(p_name), ''), 'Nova operação'), false)
  returning id into v_id;

  perform public.refresh_company_sector_intelligence(p_company_id);

  return v_id;
end;
$$;

revoke all on function public.add_company_operation(uuid, text, text) from public;
grant execute on function public.add_company_operation(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Reativa coleta de produtos/serviços no questionário (perfil econômico)
-- ---------------------------------------------------------------------------

update public.onboarding_questions
set
  is_active = true,
  is_optional = true,
  help_text = coalesce(
    nullif(help_text, ''),
    'Usamos produtos e serviços para montar o perfil econômico e sugerir estrutura orçamentária.'
  )
where code in ('com_products', 'food_products', 'ind_products', 'tech_products', 'srv_type');

-- Mídia: pergunta básica de atividade (catálogo estava vazio)
insert into public.onboarding_questions (
  code, question, help_text, answer_type, options, sort_order, is_active,
  segment_code, maps_to, is_optional, option_source
)
values (
  'media_type',
  'Qual é o tipo de operação de mídia?',
  'Ajuda a selecionar conhecimento e fontes do setor de comunicação.',
  'single',
  '[{"value":"Conteúdo","label":"Conteúdo"},{"value":"Publicidade","label":"Publicidade"},{"value":"Jornalismo","label":"Jornalismo"},{"value":"Produção audiovisual","label":"Produção audiovisual"},{"value":"Outro","label":"Outro"}]'::jsonb,
  110,
  true,
  'media',
  'fact.media_type',
  false,
  'static'
)
on conflict (code) do update set
  question = excluded.question,
  help_text = excluded.help_text,
  answer_type = excluded.answer_type,
  options = excluded.options,
  sort_order = excluded.sort_order,
  is_active = true,
  segment_code = excluded.segment_code,
  maps_to = excluded.maps_to,
  is_optional = excluded.is_optional;

insert into public.onboarding_questions (
  code, question, help_text, answer_type, options, sort_order, is_active,
  segment_code, maps_to, is_optional, option_source
)
values (
  'media_products',
  'Quais produtos ou serviços de mídia a empresa oferecece?',
  'Separe por vírgula. Ex.: podcast, vídeo, anúncios digitais.',
  'text',
  '[]'::jsonb,
  120,
  true,
  'media',
  'fact.media_products',
  true,
  'static'
)
on conflict (code) do update set
  question = excluded.question,
  help_text = excluded.help_text,
  is_active = true,
  segment_code = excluded.segment_code,
  maps_to = excluded.maps_to,
  is_optional = true;

-- Inclui mídia nos extratores do perfil econômico
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
    p_facts->>'media_type',
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
        select unnest(public._json_fact_to_text_array(p_facts, 'media_products'))
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
