-- Endurece a busca setorial de produtos:
-- - sanitiza query (tamanho + escape de curingas LIKE)
-- - valida segmentos no catálogo oficial (máx. 8)
-- - preferência: deriva ramos da empresa no backend (não confia só no client)
-- - rate limit simples por usuário autenticado
-- - timeout curto na função

create table if not exists public.rpc_rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  rpc_name text not null,
  window_started_at timestamptz not null default now(),
  call_count integer not null default 0
    check (call_count >= 0),
  primary key (user_id, rpc_name)
);

alter table public.rpc_rate_limits enable row level security;

-- Sem policies de SELECT/INSERT/UPDATE para authenticated:
-- só security definer escreve/lê esta tabela.

create or replace function public._enforce_rpc_rate_limit(
  p_rpc_name text,
  p_max_calls integer default 30,
  p_window_seconds integer default 60
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_window_start timestamptz;
  v_count integer;
  v_now timestamptz := clock_timestamp();
begin
  if v_user is null then
    raise exception 'Usuário não autenticado';
  end if;

  if p_max_calls < 1 or p_window_seconds < 1 then
    raise exception 'Parâmetros de rate limit inválidos';
  end if;

  insert into public.rpc_rate_limits (user_id, rpc_name, window_started_at, call_count)
  values (v_user, p_rpc_name, v_now, 1)
  on conflict (user_id, rpc_name) do update
    set
      window_started_at = case
        when public.rpc_rate_limits.window_started_at
          <= v_now - make_interval(secs => p_window_seconds)
          then v_now
        else public.rpc_rate_limits.window_started_at
      end,
      call_count = case
        when public.rpc_rate_limits.window_started_at
          <= v_now - make_interval(secs => p_window_seconds)
          then 1
        else public.rpc_rate_limits.call_count + 1
      end
  returning window_started_at, call_count
  into v_window_start, v_count;

  if v_count > p_max_calls then
    raise exception
      using errcode = 'P0001',
            message = 'Muitas buscas em pouco tempo. Aguarde um momento e tente de novo.';
  end if;
end;
$$;

revoke all on function public._enforce_rpc_rate_limit(text, integer, integer) from public;

create or replace function public._sanitize_search_query(p_query text)
returns text
language sql
immutable
as $$
  select nullif(
    left(
      regexp_replace(
        trim(coalesce(p_query, '')),
        -- Remove caracteres de controle; mantém letras/números/pontuação comum
        E'[\\x00-\\x1F\\x7F]',
        '',
        'g'
      ),
      120
    ),
    ''
  );
$$;

create or replace function public._escape_like_pattern(p_text text)
returns text
language sql
immutable
as $$
  -- Escape de \, % e _ para LIKE literal (ESCAPE '\')
  select replace(replace(replace(coalesce(p_text, ''), '\', '\\'), '%', '\%'), '_', '\_');
$$;

create or replace function public._normalize_segment_codes(p_segment_codes text[])
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    array(
      select s.code
      from (
        select distinct lower(trim(code)) as code
        from unnest(coalesce(p_segment_codes, '{}'::text[])) as code
        where nullif(trim(code), '') is not null
        limit 8
      ) q
      inner join public.segments s on lower(s.code) = q.code
      order by s.code
    ),
    '{}'::text[]
  );
$$;

revoke all on function public._normalize_segment_codes(text[]) from public;

create or replace function public._company_segment_codes_for_search(p_company_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_codes text[] := '{}';
  v_primary text;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;
  if p_company_id is null then
    return '{}'::text[];
  end if;
  if not public.is_company_member(p_company_id) then
    raise exception 'Você não tem acesso a esta empresa';
  end if;

  select seg.code
  into v_primary
  from public.company_profiles cp
  left join public.segments seg on seg.id = cp.segment_id
  where cp.company_id = p_company_id;

  if v_primary is not null then
    v_codes := array_append(v_codes, v_primary);
  end if;

  select coalesce(v_codes, '{}'::text[]) || coalesce(
    array(
      select distinct seg.code
      from public.company_operations op
      join public.segments seg on seg.id = op.segment_id
      where op.company_id = p_company_id
        and op.is_primary = false
        and seg.code is not null
      order by seg.code
      limit 7
    ),
    '{}'::text[]
  )
  into v_codes;

  return public._normalize_segment_codes(v_codes);
end;
$$;

revoke all on function public._company_segment_codes_for_search(uuid) from public;

create or replace function public.search_sector_products(
  p_segment_codes text[],
  p_query text default null,
  p_limit integer default 40,
  p_company_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '2s'
as $$
declare
  v_segments text[];
  v_company_segments text[] := '{}';
  v_client_segments text[] := '{}';
  v_query text;
  v_query_escaped text;
  v_limit integer;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  -- Rate limit: 30 buscas / minuto por usuário
  perform public._enforce_rpc_rate_limit('search_sector_products', 30, 60);

  -- Client pode sugerir ramos (ex.: outras operações ainda só no wizard),
  -- mas só códigos que existem no catálogo oficial entram.
  v_client_segments := public._normalize_segment_codes(p_segment_codes);

  if p_company_id is not null then
    -- Exige membership; traz ramo/operações já gravados no backend
    v_company_segments := public._company_segment_codes_for_search(p_company_id);
  end if;

  v_segments := public._normalize_segment_codes(
    coalesce(v_company_segments, '{}'::text[]) || coalesce(v_client_segments, '{}'::text[])
  );

  if coalesce(array_length(v_segments, 1), 0) = 0 then
    return '[]'::jsonb;
  end if;

  v_query := public._sanitize_search_query(p_query);
  v_query_escaped := case
    when v_query is null then null
    else public._escape_like_pattern(lower(v_query))
  end;
  v_limit := greatest(1, least(coalesce(p_limit, 40), 40));

  with ranked as (
    select
      k.code,
      k.name,
      k.description,
      k.segment_code,
      s.code as source_code,
      s.name as source_name,
      k.sort_order,
      case
        when v_query is null then 100
        when lower(k.name) = lower(v_query) then 300
        when lower(k.name) like v_query_escaped || '%' escape '\' then 240
        when lower(k.name) like '%' || v_query_escaped || '%' escape '\' then 200
        when lower(coalesce(k.description, '')) like '%' || v_query_escaped || '%' escape '\' then 160
        when exists (
          select 1
          from unnest(string_to_array(lower(v_query), ' ')) as token
          where length(token) >= 3
            and length(token) <= 40
            and (
              lower(k.name) like '%' || public._escape_like_pattern(token) || '%' escape '\'
              or lower(coalesce(k.description, ''))
                like '%' || public._escape_like_pattern(token) || '%' escape '\'
            )
        ) then 120
        else 0
      end as rank_score
    from public.sector_knowledge_items k
    left join public.sector_data_sources s on s.id = k.source_id
    where k.is_active
      and k.kind = 'product'
      and k.segment_code = any (v_segments)
      and (
        k.source_id is null
        or exists (
          select 1
          from public.segment_data_sources sds
          where sds.segment_code = k.segment_code
            and sds.source_id = k.source_id
        )
      )
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'code', r.code,
        'name', r.name,
        'description', r.description,
        'segment_code', r.segment_code,
        'source_code', r.source_code,
        'source_name', r.source_name,
        'rank_score', r.rank_score
      )
      order by r.rank_score desc, r.sort_order asc, r.name asc
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select *
    from ranked
    where v_query is null or rank_score > 0
    order by rank_score desc, sort_order asc, name asc
    limit v_limit
  ) r;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

-- Remove overload antiga (3 args) para forçar a assinatura endurecida
drop function if exists public.search_sector_products(text[], text, integer);

revoke all on function public.search_sector_products(text[], text, integer, uuid) from public;
grant execute on function public.search_sector_products(text[], text, integer, uuid) to authenticated;

-- Catálogo setorial: somente leitura para authenticated (sem escrita via client)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sector_knowledge_items'
      and policyname = 'sector_knowledge_items_select_authenticated'
  ) then
    create policy "sector_knowledge_items_select_authenticated"
      on public.sector_knowledge_items for select to authenticated
      using (is_active = true);
  end if;
end;
$$;
