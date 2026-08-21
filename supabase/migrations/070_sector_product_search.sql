-- Busca inteligente de produtos/serviços por ramo + outras operações.
-- Consulta apenas o catálogo setorial já vinculado às fontes do segmento
-- (sem varrer fontes irrelevantes). Inclui fluxo "Outro" → descrição → rebusca.

-- ---------------------------------------------------------------------------
-- Helper de upsert (mesmo padrão do catálogo setorial)
-- ---------------------------------------------------------------------------

create or replace function public._upsert_sector_knowledge(
  p_segment text,
  p_kind text,
  p_code text,
  p_name text,
  p_description text default null,
  p_source text default null,
  p_sort integer default 0,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_id uuid;
begin
  if p_source is not null then
    select id into v_source_id from public.sector_data_sources where code = p_source;
  end if;

  insert into public.sector_knowledge_items (
    segment_code, kind, code, name, description, source_id, sort_order, metadata, is_active
  )
  values (
    p_segment, p_kind, p_code, p_name, p_description, v_source_id, p_sort,
    coalesce(p_metadata, '{}'::jsonb), true
  )
  on conflict (segment_code, kind, code) do update set
    name = excluded.name,
    description = excluded.description,
    source_id = excluded.source_id,
    sort_order = excluded.sort_order,
    metadata = excluded.metadata,
    is_active = true,
    updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Catálogo concreto de produtos/serviços por ramo (selecionáveis no cadastro)
-- ---------------------------------------------------------------------------

-- Agricultura
select public._upsert_sector_knowledge('agro', 'product', 'soja', 'Soja', 'Grão / oleaginosa', 'conab', 10);
select public._upsert_sector_knowledge('agro', 'product', 'milho', 'Milho', 'Grão', 'conab', 20);
select public._upsert_sector_knowledge('agro', 'product', 'cafe', 'Café', 'Cultura permanente', 'cepea', 30);
select public._upsert_sector_knowledge('agro', 'product', 'cana', 'Cana-de-açúcar', 'Cultura permanente', 'conab', 40);
select public._upsert_sector_knowledge('agro', 'product', 'algodao', 'Algodão', 'Fibra', 'conab', 50);
select public._upsert_sector_knowledge('agro', 'product', 'trigo', 'Trigo', 'Grão', 'conab', 60);
select public._upsert_sector_knowledge('agro', 'product', 'hortalicas', 'Hortaliças', 'Olericultura', 'embrapa', 70);
select public._upsert_sector_knowledge('agro', 'product', 'frutas', 'Frutas', 'Fruticultura', 'embrapa', 80);

-- Pecuária
select public._upsert_sector_knowledge('livestock', 'product', 'bovinos_corte', 'Bovinos de corte', null, 'cna_brasil', 10);
select public._upsert_sector_knowledge('livestock', 'product', 'leite', 'Leite', null, 'cepea', 20);
select public._upsert_sector_knowledge('livestock', 'product', 'aves', 'Aves / frango', null, 'embrapa', 30);
select public._upsert_sector_knowledge('livestock', 'product', 'suinos', 'Suínos', null, 'embrapa', 40);
select public._upsert_sector_knowledge('livestock', 'product', 'ovos', 'Ovos', null, 'embrapa', 50);
select public._upsert_sector_knowledge('livestock', 'product', 'ovinos', 'Ovinos / caprinos', null, 'cna_brasil', 60);

-- Pesca
select public._upsert_sector_knowledge('fishing', 'product', 'tilapia', 'Tilápia', null, 'peixe_br', 10);
select public._upsert_sector_knowledge('fishing', 'product', 'tambaqui', 'Tambaqui', null, 'peixe_br', 20);
select public._upsert_sector_knowledge('fishing', 'product', 'camarao', 'Camarão', null, 'peixe_br', 30);
select public._upsert_sector_knowledge('fishing', 'product', 'peixes_nativos', 'Peixes nativos', null, 'embrapa', 40);
select public._upsert_sector_knowledge('fishing', 'product', 'pescado_fresco', 'Pescado fresco', null, 'ibge', 50);

-- Comércio
select public._upsert_sector_knowledge('commerce', 'product', 'alimentos_bebidas', 'Alimentos e bebidas', null, 'sebrae_intel', 10);
select public._upsert_sector_knowledge('commerce', 'product', 'vestuario', 'Vestuário e calçados', null, 'sebrae_intel', 20);
select public._upsert_sector_knowledge('commerce', 'product', 'eletronicos', 'Eletrônicos e informática', null, 'ibge', 30);
select public._upsert_sector_knowledge('commerce', 'product', 'material_construcao', 'Material de construção', null, 'ibge', 40);
select public._upsert_sector_knowledge('commerce', 'product', 'farmacia', 'Farmácia e higiene', null, 'sebrae_intel', 50);
select public._upsert_sector_knowledge('commerce', 'product', 'casa_decoracao', 'Casa e decoração', null, 'sebrae', 60);
select public._upsert_sector_knowledge('commerce', 'product', 'autopecas', 'Autopeças', null, 'mapa_empresas', 70);
select public._upsert_sector_knowledge('commerce', 'product', 'atacado_geral', 'Atacado / distribuição', null, 'ibge', 80);

-- Indústria
select public._upsert_sector_knowledge('industry', 'product', 'alimentos_ind', 'Alimentos industrializados', null, 'cni', 10);
select public._upsert_sector_knowledge('industry', 'product', 'metalurgicos', 'Produtos metalúrgicos', null, 'cni', 20);
select public._upsert_sector_knowledge('industry', 'product', 'quimicos', 'Produtos químicos', null, 'cni', 30);
select public._upsert_sector_knowledge('industry', 'product', 'texteis', 'Produtos têxteis', null, 'cni', 40);
select public._upsert_sector_knowledge('industry', 'product', 'moveis', 'Móveis', null, 'ibge', 50);
select public._upsert_sector_knowledge('industry', 'product', 'embalagens', 'Embalagens', null, 'cni', 60);
select public._upsert_sector_knowledge('industry', 'product', 'maquinas', 'Máquinas e equipamentos', null, 'cni', 70);

-- Construção
select public._upsert_sector_knowledge('construction', 'product', 'obras_residenciais', 'Obras residenciais', null, 'cbic', 10);
select public._upsert_sector_knowledge('construction', 'product', 'obras_comerciais', 'Obras comerciais', null, 'cbic', 20);
select public._upsert_sector_knowledge('construction', 'product', 'infraestrutura', 'Infraestrutura', null, 'cbic', 30);
select public._upsert_sector_knowledge('construction', 'product', 'reformas', 'Reformas e retrofit', null, 'sebrae', 40);
select public._upsert_sector_knowledge('construction', 'product', 'incorporacao', 'Incorporação imobiliária', null, 'cbic', 50);

-- Serviços
select public._upsert_sector_knowledge('services', 'product', 'consultoria', 'Consultoria', null, 'sebrae', 10);
select public._upsert_sector_knowledge('services', 'product', 'manutencao', 'Manutenção e reparos', null, 'ibge', 20);
select public._upsert_sector_knowledge('services', 'product', 'instalacao', 'Instalação técnica', null, 'sebrae', 30);
select public._upsert_sector_knowledge('services', 'product', 'limpeza', 'Limpeza e facilities', null, 'sebrae', 40);
select public._upsert_sector_knowledge('services', 'product', 'seguranca', 'Segurança patrimonial', null, 'ibge', 50);
select public._upsert_sector_knowledge('services', 'product', 'suporte_b2b', 'Suporte B2B', null, 'sebrae', 60);

-- Tecnologia
select public._upsert_sector_knowledge('tech', 'product', 'saas', 'SaaS / software assinatura', null, 'brasscom', 10);
select public._upsert_sector_knowledge('tech', 'product', 'software_sob_demanda', 'Software sob demanda', null, 'abes', 20);
select public._upsert_sector_knowledge('tech', 'product', 'app_mobile', 'Aplicativo mobile', null, 'abes', 30);
select public._upsert_sector_knowledge('tech', 'product', 'consultoria_ti', 'Consultoria de TI', null, 'brasscom', 40);
select public._upsert_sector_knowledge('tech', 'product', 'infra_cloud', 'Infraestrutura / cloud', null, 'brasscom', 50);
select public._upsert_sector_knowledge('tech', 'product', 'dados_ia', 'Dados e IA', null, 'abes', 60);
select public._upsert_sector_knowledge('tech', 'product', 'suporte_ti', 'Suporte e MSP', null, 'brasscom', 70);

-- Transporte
select public._upsert_sector_knowledge('transport_logistics', 'product', 'frete_rodoviario', 'Frete rodoviário', null, 'antt', 10);
select public._upsert_sector_knowledge('transport_logistics', 'product', 'armazenagem', 'Armazenagem', null, 'cnt', 20);
select public._upsert_sector_knowledge('transport_logistics', 'product', 'distribuicao_ultima_milha', 'Última milha / delivery', null, 'cnt', 30);
select public._upsert_sector_knowledge('transport_logistics', 'product', 'transporte_passageiros', 'Transporte de passageiros', null, 'antt', 40);
select public._upsert_sector_knowledge('transport_logistics', 'product', 'logistica_integrada', 'Logística integrada', null, 'cnt', 50);

-- Alimentação
select public._upsert_sector_knowledge('food', 'product', 'refeicoes', 'Refeições / pratos', null, 'abia', 10);
select public._upsert_sector_knowledge('food', 'product', 'lanches', 'Lanches', null, 'sebrae', 20);
select public._upsert_sector_knowledge('food', 'product', 'marmitas', 'Marmitas', null, 'sebrae', 30);
select public._upsert_sector_knowledge('food', 'product', 'padaria_confeitaria', 'Padaria e confeitaria', null, 'abia', 40);
select public._upsert_sector_knowledge('food', 'product', 'bebidas', 'Bebidas', null, 'abia', 50);
select public._upsert_sector_knowledge('food', 'product', 'delivery_food', 'Delivery de alimentos', null, 'sebrae', 60);
select public._upsert_sector_knowledge('food', 'product', 'buffet_eventos', 'Buffet e eventos', null, 'sebrae', 70);

-- Hotelaria
select public._upsert_sector_knowledge('hospitality', 'product', 'hospedagem', 'Hospedagem / diárias', null, 'min_turismo', 10);
select public._upsert_sector_knowledge('hospitality', 'product', 'pacotes_turismo', 'Pacotes turísticos', null, 'embratur', 20);
select public._upsert_sector_knowledge('hospitality', 'product', 'eventos_hotel', 'Eventos e salões', null, 'min_turismo', 30);
select public._upsert_sector_knowledge('hospitality', 'product', 'alimentacao_hotel', 'Alimentação no hotel', null, 'embratur', 40);
select public._upsert_sector_knowledge('hospitality', 'product', 'spa_wellness', 'Spa e wellness', null, 'min_turismo', 50);

-- Saúde
select public._upsert_sector_knowledge('health', 'product', 'consultas', 'Consultas', null, 'ans', 10);
select public._upsert_sector_knowledge('health', 'product', 'exames', 'Exames e laudos', null, 'min_saude', 20);
select public._upsert_sector_knowledge('health', 'product', 'procedimentos', 'Procedimentos', null, 'ans', 30);
select public._upsert_sector_knowledge('health', 'product', 'cirurgias', 'Cirurgias', null, 'ans', 40);
select public._upsert_sector_knowledge('health', 'product', 'terapias', 'Terapias e reabilitação', null, 'min_saude', 50);
select public._upsert_sector_knowledge('health', 'product', 'planos_saude', 'Planos e convênios', null, 'ans', 60);

-- Educação
select public._upsert_sector_knowledge('education', 'product', 'ensino_regular', 'Ensino regular', null, 'inep', 10);
select public._upsert_sector_knowledge('education', 'product', 'cursos_livres', 'Cursos livres', null, 'mec', 20);
select public._upsert_sector_knowledge('education', 'product', 'graduacao', 'Graduação / pós', null, 'inep', 30);
select public._upsert_sector_knowledge('education', 'product', 'treinamento_corporativo', 'Treinamento corporativo', null, 'sebrae', 40);
select public._upsert_sector_knowledge('education', 'product', 'ead', 'EAD / educação digital', null, 'mec', 50);

-- Imobiliário
select public._upsert_sector_knowledge('real_estate', 'product', 'venda_imoveis', 'Venda de imóveis', null, 'secovi', 10);
select public._upsert_sector_knowledge('real_estate', 'product', 'aluguel', 'Aluguel', null, 'secovi', 20);
select public._upsert_sector_knowledge('real_estate', 'product', 'administracao_predial', 'Administração predial', null, 'secovi', 30);
select public._upsert_sector_knowledge('real_estate', 'product', 'corretagem', 'Corretagem', null, 'cbic', 40);

-- Financeiro
select public._upsert_sector_knowledge('financial', 'product', 'credito', 'Crédito e financiamento', null, 'banco_central', 10);
select public._upsert_sector_knowledge('financial', 'product', 'seguros', 'Seguros', null, 'banco_central', 20);
select public._upsert_sector_knowledge('financial', 'product', 'correspondente', 'Correspondente bancário', null, 'banco_central', 30);
select public._upsert_sector_knowledge('financial', 'product', 'investimentos', 'Investimentos', null, 'cvm', 40);
select public._upsert_sector_knowledge('financial', 'product', 'consultoria_financeira', 'Consultoria financeira', null, 'cvm', 50);

-- Automotivo
select public._upsert_sector_knowledge('automotive', 'product', 'manutencao_veiculos', 'Manutenção de veículos', null, 'fenabrave', 10);
select public._upsert_sector_knowledge('automotive', 'product', 'pecas', 'Peças e acessórios', null, 'fenabrave', 20);
select public._upsert_sector_knowledge('automotive', 'product', 'venda_veiculos', 'Venda de veículos', null, 'anfavea', 30);
select public._upsert_sector_knowledge('automotive', 'product', 'estetica_auto', 'Estética automotiva', null, 'fenabrave', 40);
select public._upsert_sector_knowledge('automotive', 'product', 'funilaria', 'Funilaria e pintura', null, 'fenabrave', 50);

-- Energia
select public._upsert_sector_knowledge('energy', 'product', 'energia_solar', 'Energia solar', null, 'aneel', 10);
select public._upsert_sector_knowledge('energy', 'product', 'energia_eolica', 'Energia eólica', null, 'epe', 20);
select public._upsert_sector_knowledge('energy', 'product', 'distribuicao_energia', 'Distribuição de energia', null, 'aneel', 30);
select public._upsert_sector_knowledge('energy', 'product', 'eficiencia_energetica', 'Eficiência energética', null, 'epe', 40);
select public._upsert_sector_knowledge('energy', 'product', 'instalacao_sistemas', 'Instalação de sistemas', null, 'aneel', 50);

-- Mineração
select public._upsert_sector_knowledge('mining', 'product', 'minerio_ferro', 'Minério de ferro', null, 'ibram', 10);
select public._upsert_sector_knowledge('mining', 'product', 'agregados', 'Agregados (areia, brita)', null, 'anm', 20);
select public._upsert_sector_knowledge('mining', 'product', 'minerais_industriais', 'Minerais industriais', null, 'ibram', 30);
select public._upsert_sector_knowledge('mining', 'product', 'joias_gemas', 'Gemas e joias', null, 'anm', 40);

-- Mídia
select public._upsert_sector_knowledge('media', 'product', 'conteudo_digital', 'Conteúdo digital', null, 'secom', 10);
select public._upsert_sector_knowledge('media', 'product', 'publicidade', 'Publicidade', null, 'assoc_midia', 20);
select public._upsert_sector_knowledge('media', 'product', 'jornalismo', 'Jornalismo', null, 'ibge', 30);
select public._upsert_sector_knowledge('media', 'product', 'audiovisual', 'Produção audiovisual', null, 'assoc_midia', 40);
select public._upsert_sector_knowledge('media', 'product', 'podcast', 'Podcast', null, 'secom', 50);

-- Marketing
select public._upsert_sector_knowledge('marketing', 'product', 'gestao_midia', 'Gestão de mídia', null, 'iab_brasil', 10);
select public._upsert_sector_knowledge('marketing', 'product', 'criacao_campanhas', 'Criação de campanhas', null, 'cenp', 20);
select public._upsert_sector_knowledge('marketing', 'product', 'social_media', 'Social media', null, 'iab_brasil', 30);
select public._upsert_sector_knowledge('marketing', 'product', 'branding', 'Branding', null, 'cenp', 40);
select public._upsert_sector_knowledge('marketing', 'product', 'performance_digital', 'Performance digital', null, 'iab_brasil', 50);

-- Entretenimento
select public._upsert_sector_knowledge('entertainment', 'product', 'ingressos', 'Ingressos e bilheteria', null, 'min_cultura', 10);
select public._upsert_sector_knowledge('entertainment', 'product', 'shows', 'Shows e espetáculos', null, 'ibge', 20);
select public._upsert_sector_knowledge('entertainment', 'product', 'producao_cultural', 'Produção cultural', null, 'min_cultura', 30);
select public._upsert_sector_knowledge('entertainment', 'product', 'espaco_eventos', 'Espaço para eventos', null, 'ibge', 40);

-- Esporte
select public._upsert_sector_knowledge('sports', 'product', 'mensalidades_academia', 'Mensalidades de academia', null, 'sebrae', 10);
select public._upsert_sector_knowledge('sports', 'product', 'aulas_esportivas', 'Aulas esportivas', null, 'assoc_esporte', 20);
select public._upsert_sector_knowledge('sports', 'product', 'eventos_esportivos', 'Eventos esportivos', null, 'ibge', 30);
select public._upsert_sector_knowledge('sports', 'product', 'personal_treino', 'Personal trainer', null, 'sebrae', 40);
select public._upsert_sector_knowledge('sports', 'product', 'aluguel_quadra', 'Aluguel de quadra/arena', null, 'assoc_esporte', 50);

-- Beleza
select public._upsert_sector_knowledge('beauty', 'product', 'cabelo', 'Cabelo', null, 'abihpec', 10);
select public._upsert_sector_knowledge('beauty', 'product', 'estetica', 'Estética', null, 'abihpec', 20);
select public._upsert_sector_knowledge('beauty', 'product', 'unhas', 'Unhas', null, 'sebrae', 30);
select public._upsert_sector_knowledge('beauty', 'product', 'barbearia', 'Barbearia', null, 'sebrae', 40);
select public._upsert_sector_knowledge('beauty', 'product', 'produtos_beleza', 'Produtos de beleza', null, 'abihpec', 50);

-- Profissionais
select public._upsert_sector_knowledge('professional', 'product', 'consultoria_profissional', 'Consultoria', null, 'sebrae', 10);
select public._upsert_sector_knowledge('professional', 'product', 'advocacia', 'Advocacia', null, 'conselhos_prof', 20);
select public._upsert_sector_knowledge('professional', 'product', 'contabilidade', 'Contabilidade', null, 'conselhos_prof', 30);
select public._upsert_sector_knowledge('professional', 'product', 'engenharia', 'Engenharia', null, 'conselhos_prof', 40);
select public._upsert_sector_knowledge('professional', 'product', 'arquitetura', 'Arquitetura', null, 'conselhos_prof', 50);

-- Meio ambiente
select public._upsert_sector_knowledge('environment', 'product', 'gestao_residuos', 'Gestão de resíduos', null, 'ibama', 10);
select public._upsert_sector_knowledge('environment', 'product', 'licenciamento', 'Licenciamento ambiental', null, 'ibama', 20);
select public._upsert_sector_knowledge('environment', 'product', 'consultoria_ambiental', 'Consultoria ambiental', null, 'ana', 30);
select public._upsert_sector_knowledge('environment', 'product', 'reciclagem', 'Reciclagem', null, 'ibge', 40);

-- Administração pública
select public._upsert_sector_knowledge('public_admin', 'product', 'servicos_publicos', 'Serviços públicos', null, 'portal_transparencia', 10);
select public._upsert_sector_knowledge('public_admin', 'product', 'programas_sociais', 'Programas sociais', null, 'tesouro_nacional', 20);
select public._upsert_sector_knowledge('public_admin', 'product', 'gestao_orcamentaria', 'Gestão orçamentária', null, 'tesouro_nacional', 30);

-- Outros
select public._upsert_sector_knowledge('other', 'product', 'produto_generico', 'Produto da atividade', null, 'sebrae', 10);
select public._upsert_sector_knowledge('other', 'product', 'servico_generico', 'Serviço da atividade', null, 'ibge', 20);

drop function if exists public._upsert_sector_knowledge(text, text, text, text, text, text, integer, jsonb);

-- ---------------------------------------------------------------------------
-- RPC: busca produtos/serviços só nos ramos informados (+ query opcional)
-- ---------------------------------------------------------------------------

create or replace function public.search_sector_products(
  p_segment_codes text[],
  p_query text default null,
  p_limit integer default 40
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_segments text[];
  v_query text;
  v_limit integer;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  v_segments := array(
    select distinct lower(trim(code))
    from unnest(coalesce(p_segment_codes, '{}'::text[])) as code
    where nullif(trim(code), '') is not null
  );

  if coalesce(array_length(v_segments, 1), 0) = 0 then
    return '[]'::jsonb;
  end if;

  v_query := nullif(trim(coalesce(p_query, '')), '');
  v_limit := greatest(1, least(coalesce(p_limit, 40), 80));

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
        when lower(k.name) like lower(v_query) || '%' then 240
        when lower(k.name) like '%' || lower(v_query) || '%' then 200
        when lower(coalesce(k.description, '')) like '%' || lower(v_query) || '%' then 160
        when exists (
          select 1
          from unnest(string_to_array(lower(v_query), ' ')) as token
          where length(token) >= 3
            and (
              lower(k.name) like '%' || token || '%'
              or lower(coalesce(k.description, '')) like '%' || token || '%'
            )
        ) then 120
        else 0
      end as rank_score
    from public.sector_knowledge_items k
    left join public.sector_data_sources s on s.id = k.source_id
    where k.is_active
      and k.kind = 'product'
      and lower(k.segment_code) = any (v_segments)
      -- Só itens cuja fonte está mapeada ao segmento (ou sem fonte)
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

revoke all on function public.search_sector_products(text[], text, integer) from public;
grant execute on function public.search_sector_products(text[], text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Questionário: pergunta unificada de produtos + fluxo "Outro"
-- ---------------------------------------------------------------------------

insert into public.onboarding_questions (
  code, question, help_text, answer_type, options, sort_order, is_active,
  segment_code, maps_to, is_optional, option_source, show_when
)
values (
  'products_offered',
  'Qual produto ou tipo de serviço a empresa vende?',
  'As opções vêm do ramo e das outras operações, com base nas fontes setoriais. Pode marcar mais de um.',
  'multiple',
  '[]'::jsonb,
  90,
  true,
  null,
  'fact.products_offered',
  false,
  'sector_products',
  null
)
on conflict (code) do update set
  question = excluded.question,
  help_text = excluded.help_text,
  answer_type = excluded.answer_type,
  sort_order = excluded.sort_order,
  is_active = true,
  segment_code = null,
  maps_to = excluded.maps_to,
  is_optional = false,
  option_source = 'sector_products',
  show_when = null;

insert into public.onboarding_questions (
  code, question, help_text, answer_type, options, sort_order, is_active,
  segment_code, maps_to, is_optional, option_source, show_when
)
values (
  'products_other_describe',
  'Descreva o produto ou serviço que a empresa vende',
  'Com a descrição, buscamos novamente nas fontes do seu ramo opções relacionadas.',
  'text',
  '[]'::jsonb,
  91,
  true,
  null,
  'fact.products_other_describe',
  false,
  'static',
  '{"includes":{"answer":"products_offered","value":"outro"}}'::jsonb
)
on conflict (code) do update set
  question = excluded.question,
  help_text = excluded.help_text,
  answer_type = 'text',
  sort_order = 91,
  is_active = true,
  segment_code = null,
  maps_to = 'fact.products_other_describe',
  is_optional = false,
  option_source = 'static',
  show_when = excluded.show_when;

insert into public.onboarding_questions (
  code, question, help_text, answer_type, options, sort_order, is_active,
  segment_code, maps_to, is_optional, option_source, show_when
)
values (
  'products_other_matches',
  'Encontramos estas opções relacionadas. Quais se encaixam?',
  'Selecione as que correspondem à descrição. Se nenhuma servir, pule e usamos o texto informado.',
  'multiple',
  '[]'::jsonb,
  92,
  true,
  null,
  'fact.products_other_matches',
  true,
  'sector_products_query',
  '{"all":[{"includes":{"answer":"products_offered","value":"outro"}},{"not":{"answerMissing":"products_other_describe"}}]}'::jsonb
)
on conflict (code) do update set
  question = excluded.question,
  help_text = excluded.help_text,
  answer_type = 'multiple',
  sort_order = 92,
  is_active = true,
  segment_code = null,
  maps_to = 'fact.products_other_matches',
  is_optional = true,
  option_source = 'sector_products_query',
  show_when = excluded.show_when;

-- Texto livre por segmento deixa de ser a via principal (evita pergunta duplicada)
update public.onboarding_questions
set is_active = false
where code in (
  'com_products',
  'food_products',
  'ind_products',
  'tech_products',
  'media_products',
  'srv_type'
);

-- Perfil econômico também lê a nova coleta unificada
create or replace function public._economic_products_from_facts(p_facts jsonb)
returns text[]
language sql
immutable
as $$
  select coalesce(
    (
      select array_agg(distinct trim(v) order by trim(v))
      from (
        select unnest(public._json_fact_to_text_array(p_facts, 'products_offered')) as v
        union all
        select unnest(public._json_fact_to_text_array(p_facts, 'products_other_matches'))
        union all
        select unnest(public._json_fact_to_text_array(p_facts, 'products_other_describe'))
        union all
        select unnest(public._json_fact_to_text_array(p_facts, 'products_sold'))
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
        and lower(trim(v)) not in ('outro', 'outra', 'outros', '__skipped__')
    ),
    '{}'::text[]
  );
$$;
