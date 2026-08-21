-- Catálogo de conhecimento setorial (estrutura econômica por ramo).
-- Itens são templates de personalização — não são benchmarks inventados.
-- Benchmarks numéricos só entram em sector_benchmarks com source_id obrigatório.

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

-- Agricultura
select public._upsert_sector_knowledge('agro', 'subramo', 'grains', 'Grãos', 'Produção de grãos e oleaginosas', 'conab', 10);
select public._upsert_sector_knowledge('agro', 'subramo', 'perennials', 'Culturas permanentes', 'Café, cana, fruticultura e perenes', 'embrapa', 20);
select public._upsert_sector_knowledge('agro', 'activity', 'crop_production', 'Produção vegetal', 'Cultivo e colheita', 'cna_brasil', 10);
select public._upsert_sector_knowledge('agro', 'product', 'crops', 'Culturas agrícolas', 'Soja, milho, café, cana e outras', 'conab', 10);
select public._upsert_sector_knowledge('agro', 'revenue', 'crop_sales', 'Venda de produção agrícola', null, 'cepea', 10);
select public._upsert_sector_knowledge('agro', 'cost', 'inputs', 'Insumos agrícolas', 'Sementes, fertilizantes e defensivos', 'embrapa', 10);
select public._upsert_sector_knowledge('agro', 'cost', 'labor_field', 'Mão de obra de campo', null, 'cna_brasil', 20);
select public._upsert_sector_knowledge('agro', 'expense', 'land_lease', 'Arrendamento de terra', null, 'cna_brasil', 10);
select public._upsert_sector_knowledge('agro', 'indicator', 'cost_per_hectare', 'Custo por hectare', null, 'cepea', 10);
select public._upsert_sector_knowledge('agro', 'indicator', 'productivity_ha', 'Produtividade por hectare', null, 'conab', 20);
select public._upsert_sector_knowledge('agro', 'benchmark_metric', 'yield_ha', 'Produtividade média por hectare', 'Métrica acompanhada via CONAB/CEPEA quando houver dado ingerido', 'conab', 10);

-- Pecuária
select public._upsert_sector_knowledge('livestock', 'subramo', 'beef', 'Bovinocultura de corte', null, 'cna_brasil', 10);
select public._upsert_sector_knowledge('livestock', 'subramo', 'dairy', 'Bovinocultura de leite', null, 'cna_brasil', 20);
select public._upsert_sector_knowledge('livestock', 'subramo', 'poultry', 'Avicultura', null, 'embrapa', 30);
select public._upsert_sector_knowledge('livestock', 'activity', 'animal_raising', 'Criação animal', null, 'embrapa', 10);
select public._upsert_sector_knowledge('livestock', 'product', 'animals_meat_milk', 'Animais, carne e leite', null, 'cepea', 10);
select public._upsert_sector_knowledge('livestock', 'revenue', 'animal_sales', 'Venda de animais e produção', null, 'cepea', 10);
select public._upsert_sector_knowledge('livestock', 'cost', 'feed', 'Alimentação animal', null, 'embrapa', 10);
select public._upsert_sector_knowledge('livestock', 'expense', 'veterinary', 'Sanidade e veterinária', null, 'embrapa', 10);
select public._upsert_sector_knowledge('livestock', 'indicator', 'cost_per_animal', 'Custo por animal', null, 'cepea', 10);
select public._upsert_sector_knowledge('livestock', 'benchmark_metric', 'arroba_price', 'Preço da arroba', 'Somente com cotação CEPEA ingerida', 'cepea', 10);

-- Pesca
select public._upsert_sector_knowledge('fishing', 'subramo', 'pisciculture', 'Piscicultura', null, 'peixe_br', 10);
select public._upsert_sector_knowledge('fishing', 'subramo', 'capture', 'Pesca extrativa', null, 'ibge', 20);
select public._upsert_sector_knowledge('fishing', 'activity', 'aquaculture', 'Aquicultura e pesca', null, 'embrapa', 10);
select public._upsert_sector_knowledge('fishing', 'product', 'fish_species', 'Espécies aquáticas', null, 'peixe_br', 10);
select public._upsert_sector_knowledge('fishing', 'revenue', 'fish_sales', 'Venda de pescado', null, 'peixe_br', 10);
select public._upsert_sector_knowledge('fishing', 'cost', 'feed_fish', 'Ração aquática', null, 'embrapa', 10);
select public._upsert_sector_knowledge('fishing', 'indicator', 'cost_per_kg', 'Custo por kg produzido', null, 'peixe_br', 10);

-- Comércio
select public._upsert_sector_knowledge('commerce', 'subramo', 'retail', 'Varejo', null, 'sebrae_intel', 10);
select public._upsert_sector_knowledge('commerce', 'subramo', 'wholesale', 'Atacado', null, 'ibge', 20);
select public._upsert_sector_knowledge('commerce', 'activity', 'buy_sell', 'Compra e venda de mercadorias', null, 'mapa_empresas', 10);
select public._upsert_sector_knowledge('commerce', 'product', 'merchandise', 'Mercadorias comercializadas', null, 'sebrae_intel', 10);
select public._upsert_sector_knowledge('commerce', 'revenue', 'product_sales', 'Venda de produtos', null, 'sebrae_intel', 10);
select public._upsert_sector_knowledge('commerce', 'cost', 'cogs', 'CMV / custo da mercadoria', null, 'sebrae_intel', 10);
select public._upsert_sector_knowledge('commerce', 'expense', 'store_ops', 'Operação de loja e canais', null, 'sebrae', 10);
select public._upsert_sector_knowledge('commerce', 'indicator', 'gross_margin', 'Margem bruta', null, 'sebrae_intel', 10);
select public._upsert_sector_knowledge('commerce', 'indicator', 'ticket', 'Ticket médio', null, 'sebrae_intel', 20);

-- Indústria
select public._upsert_sector_knowledge('industry', 'subramo', 'food_ind', 'Alimentos', null, 'cni', 10);
select public._upsert_sector_knowledge('industry', 'subramo', 'metal', 'Metalúrgica', null, 'cni', 20);
select public._upsert_sector_knowledge('industry', 'activity', 'manufacturing', 'Manufatura', null, 'ibge', 10);
select public._upsert_sector_knowledge('industry', 'product', 'finished_goods', 'Produtos acabados', null, 'cni', 10);
select public._upsert_sector_knowledge('industry', 'revenue', 'industrial_sales', 'Venda industrial', null, 'cni', 10);
select public._upsert_sector_knowledge('industry', 'cost', 'raw_materials', 'Matéria-prima', null, 'cni', 10);
select public._upsert_sector_knowledge('industry', 'expense', 'factory_overhead', 'Despesas fabris', null, 'ibge', 10);
select public._upsert_sector_knowledge('industry', 'indicator', 'capacity_use', 'Utilização da capacidade', null, 'cni', 10);

-- Construção
select public._upsert_sector_knowledge('construction', 'subramo', 'residential', 'Residencial', null, 'cbic', 10);
select public._upsert_sector_knowledge('construction', 'subramo', 'infra', 'Infraestrutura', null, 'cbic', 20);
select public._upsert_sector_knowledge('construction', 'activity', 'building', 'Execução de obras', null, 'cbic', 10);
select public._upsert_sector_knowledge('construction', 'revenue', 'contracts', 'Contratos de obra', null, 'cbic', 10);
select public._upsert_sector_knowledge('construction', 'cost', 'materials_labor', 'Materiais e mão de obra', null, 'cbic', 10);
select public._upsert_sector_knowledge('construction', 'expense', 'site_admin', 'Administração de obra', null, 'sebrae', 10);
select public._upsert_sector_knowledge('construction', 'indicator', 'cost_per_m2', 'Custo por m²', null, 'cbic', 10);

-- Serviços
select public._upsert_sector_knowledge('services', 'activity', 'service_delivery', 'Prestação de serviços', null, 'ibge', 10);
select public._upsert_sector_knowledge('services', 'product', 'service_offers', 'Serviços oferecidos', null, 'sebrae', 10);
select public._upsert_sector_knowledge('services', 'revenue', 'service_fees', 'Receita de serviços', null, 'ibge', 10);
select public._upsert_sector_knowledge('services', 'cost', 'direct_service', 'Custos diretos do serviço', null, 'sebrae', 10);
select public._upsert_sector_knowledge('services', 'expense', 'admin_sales', 'Despesas admin e comerciais', null, 'sebrae', 10);
select public._upsert_sector_knowledge('services', 'indicator', 'margin_service', 'Margem por serviço', null, 'sebrae', 10);

-- Tecnologia
select public._upsert_sector_knowledge('tech', 'subramo', 'saas', 'SaaS', null, 'brasscom', 10);
select public._upsert_sector_knowledge('tech', 'subramo', 'custom_software', 'Software sob demanda', null, 'abes', 20);
select public._upsert_sector_knowledge('tech', 'activity', 'software_dev', 'Desenvolvimento e TI', null, 'brasscom', 10);
select public._upsert_sector_knowledge('tech', 'product', 'digital_offers', 'Produtos e serviços digitais', null, 'abes', 10);
select public._upsert_sector_knowledge('tech', 'revenue', 'subscriptions_projects', 'Assinaturas e projetos', null, 'brasscom', 10);
select public._upsert_sector_knowledge('tech', 'cost', 'cloud_dev', 'Cloud e desenvolvimento', null, 'abes', 10);
select public._upsert_sector_knowledge('tech', 'expense', 'gtm', 'Aquisição e go-to-market', null, 'brasscom', 10);
select public._upsert_sector_knowledge('tech', 'indicator', 'mrr', 'Receita recorrente', null, 'brasscom', 10);

-- Transporte
select public._upsert_sector_knowledge('transport_logistics', 'activity', 'freight', 'Transporte e logística', null, 'antt', 10);
select public._upsert_sector_knowledge('transport_logistics', 'revenue', 'freight_revenue', 'Frete e armazenagem', null, 'cnt', 10);
select public._upsert_sector_knowledge('transport_logistics', 'cost', 'fuel_fleet', 'Combustível e frota', null, 'cnt', 10);
select public._upsert_sector_knowledge('transport_logistics', 'expense', 'tolls_insurance', 'Pedágios e seguros', null, 'antt', 10);
select public._upsert_sector_knowledge('transport_logistics', 'indicator', 'cost_per_km', 'Custo por km', null, 'cnt', 10);

-- Alimentação
select public._upsert_sector_knowledge('food', 'subramo', 'restaurant', 'Restaurante', null, 'sebrae', 10);
select public._upsert_sector_knowledge('food', 'subramo', 'bakery', 'Padaria', null, 'sebrae', 20);
select public._upsert_sector_knowledge('food', 'activity', 'food_service', 'Food service', null, 'abia', 10);
select public._upsert_sector_knowledge('food', 'product', 'menu_items', 'Produtos e pratos', null, 'abia', 10);
select public._upsert_sector_knowledge('food', 'revenue', 'food_sales', 'Venda de alimentos e bebidas', null, 'abia', 10);
select public._upsert_sector_knowledge('food', 'cost', 'food_cogs', 'CMV de alimentos', null, 'abia', 10);
select public._upsert_sector_knowledge('food', 'expense', 'delivery_fees', 'Taxas de delivery', null, 'sebrae', 10);
select public._upsert_sector_knowledge('food', 'indicator', 'food_cost_pct', 'Food cost %', null, 'sebrae', 10);

-- Hotelaria
select public._upsert_sector_knowledge('hospitality', 'activity', 'lodging', 'Hospedagem e turismo', null, 'min_turismo', 10);
select public._upsert_sector_knowledge('hospitality', 'revenue', 'room_revenue', 'Diárias e hospedagem', null, 'embratur', 10);
select public._upsert_sector_knowledge('hospitality', 'cost', 'housekeeping', 'Governança e amenities', null, 'min_turismo', 10);
select public._upsert_sector_knowledge('hospitality', 'expense', 'ota_fees', 'Comissões de plataformas', null, 'embratur', 10);
select public._upsert_sector_knowledge('hospitality', 'indicator', 'occupancy', 'Taxa de ocupação', null, 'min_turismo', 10);

-- Saúde
select public._upsert_sector_knowledge('health', 'subramo', 'clinic', 'Clínica', null, 'ans', 10);
select public._upsert_sector_knowledge('health', 'activity', 'care', 'Atendimento em saúde', null, 'min_saude', 10);
select public._upsert_sector_knowledge('health', 'revenue', 'procedures', 'Consultas e procedimentos', null, 'ans', 10);
select public._upsert_sector_knowledge('health', 'cost', 'medical_supplies', 'Materiais e insumos clínicos', null, 'min_saude', 10);
select public._upsert_sector_knowledge('health', 'expense', 'compliance', 'Compliance e credenciamento', null, 'ans', 10);
select public._upsert_sector_knowledge('health', 'indicator', 'revenue_per_professional', 'Receita por profissional', null, 'ans', 10);

-- Educação
select public._upsert_sector_knowledge('education', 'subramo', 'school', 'Escola', null, 'inep', 10);
select public._upsert_sector_knowledge('education', 'activity', 'teaching', 'Ensino e formação', null, 'mec', 10);
select public._upsert_sector_knowledge('education', 'revenue', 'tuition', 'Mensalidades e cursos', null, 'inep', 10);
select public._upsert_sector_knowledge('education', 'cost', 'faculty', 'Corpo docente', null, 'mec', 10);
select public._upsert_sector_knowledge('education', 'expense', 'campus_ops', 'Operação pedagógica', null, 'sebrae', 10);
select public._upsert_sector_knowledge('education', 'indicator', 'revenue_per_student', 'Receita por aluno', null, 'inep', 10);

-- Imobiliário
select public._upsert_sector_knowledge('real_estate', 'activity', 'property_ops', 'Negócios imobiliários', null, 'secovi', 10);
select public._upsert_sector_knowledge('real_estate', 'revenue', 'sales_rent', 'Venda e aluguel', null, 'secovi', 10);
select public._upsert_sector_knowledge('real_estate', 'cost', 'acquisition', 'Aquisição e reformas', null, 'cbic', 10);
select public._upsert_sector_knowledge('real_estate', 'expense', 'condo_admin', 'Administração predial', null, 'secovi', 10);
select public._upsert_sector_knowledge('real_estate', 'indicator', 'vacancy', 'Taxa de vacância', null, 'secovi', 10);

-- Financeiro
select public._upsert_sector_knowledge('financial', 'activity', 'financial_services', 'Serviços financeiros', null, 'banco_central', 10);
select public._upsert_sector_knowledge('financial', 'revenue', 'fees_spread', 'Tarifas e spreads', null, 'banco_central', 10);
select public._upsert_sector_knowledge('financial', 'cost', 'funding', 'Custo de funding', null, 'banco_central', 10);
select public._upsert_sector_knowledge('financial', 'expense', 'compliance_risk', 'Compliance e risco', null, 'cvm', 10);
select public._upsert_sector_knowledge('financial', 'indicator', 'spread', 'Spread / margem financeira', null, 'banco_central', 10);

-- Automotivo
select public._upsert_sector_knowledge('automotive', 'subramo', 'workshop', 'Oficina', null, 'fenabrave', 10);
select public._upsert_sector_knowledge('automotive', 'subramo', 'dealership', 'Concessionária', null, 'anfavea', 20);
select public._upsert_sector_knowledge('automotive', 'activity', 'auto_ops', 'Operação automotiva', null, 'anfavea', 10);
select public._upsert_sector_knowledge('automotive', 'revenue', 'vehicles_parts', 'Veículos, peças e serviços', null, 'fenabrave', 10);
select public._upsert_sector_knowledge('automotive', 'cost', 'parts_labor', 'Peças e mão de obra', null, 'fenabrave', 10);
select public._upsert_sector_knowledge('automotive', 'indicator', 'ticket_service', 'Ticket médio de serviço', null, 'fenabrave', 10);

-- Energia
select public._upsert_sector_knowledge('energy', 'subramo', 'solar', 'Solar', null, 'aneel', 10);
select public._upsert_sector_knowledge('energy', 'activity', 'generation_dist', 'Geração e distribuição', null, 'epe', 10);
select public._upsert_sector_knowledge('energy', 'revenue', 'energy_sales', 'Venda de energia', null, 'aneel', 10);
select public._upsert_sector_knowledge('energy', 'cost', 'opex_plant', 'OPEX da operação', null, 'epe', 10);
select public._upsert_sector_knowledge('energy', 'indicator', 'capacity_factor', 'Fator de capacidade', null, 'epe', 10);

-- Mineração
select public._upsert_sector_knowledge('mining', 'activity', 'extraction', 'Extração mineral', null, 'anm', 10);
select public._upsert_sector_knowledge('mining', 'revenue', 'mineral_sales', 'Venda de minérios', null, 'ibram', 10);
select public._upsert_sector_knowledge('mining', 'cost', 'extraction_cost', 'Custo de extração', null, 'anm', 10);
select public._upsert_sector_knowledge('mining', 'expense', 'environmental', 'Licenças e meio ambiente', null, 'anm', 10);
select public._upsert_sector_knowledge('mining', 'indicator', 'cost_per_ton', 'Custo por tonelada', null, 'ibram', 10);

-- Mídia
select public._upsert_sector_knowledge('media', 'activity', 'content_media', 'Produção e distribuição de mídia', null, 'ibge', 10);
select public._upsert_sector_knowledge('media', 'revenue', 'ads_content', 'Publicidade e conteúdo', null, 'secom', 10);
select public._upsert_sector_knowledge('media', 'cost', 'production', 'Produção de conteúdo', null, 'assoc_midia', 10);
select public._upsert_sector_knowledge('media', 'indicator', 'revenue_per_project', 'Receita por projeto', null, 'ibge', 10);

-- Marketing
select public._upsert_sector_knowledge('marketing', 'activity', 'campaigns', 'Campanhas e publicidade', null, 'iab_brasil', 10);
select public._upsert_sector_knowledge('marketing', 'revenue', 'agency_fees', 'Honorários e mídia', null, 'cenp', 10);
select public._upsert_sector_knowledge('marketing', 'cost', 'media_buy', 'Compra de mídia', null, 'iab_brasil', 10);
select public._upsert_sector_knowledge('marketing', 'expense', 'tools', 'Ferramentas e criativo', null, 'sebrae', 10);
select public._upsert_sector_knowledge('marketing', 'indicator', 'retainer_share', 'Participação de contratos recorrentes', null, 'cenp', 10);

-- Entretenimento
select public._upsert_sector_knowledge('entertainment', 'activity', 'events_culture', 'Eventos e cultura', null, 'min_cultura', 10);
select public._upsert_sector_knowledge('entertainment', 'revenue', 'tickets_events', 'Ingressos e eventos', null, 'ibge', 10);
select public._upsert_sector_knowledge('entertainment', 'cost', 'production_show', 'Produção de espetáculos', null, 'min_cultura', 10);
select public._upsert_sector_knowledge('entertainment', 'indicator', 'occupancy_venue', 'Ocupação do espaço', null, 'ibge', 10);

-- Esporte
select public._upsert_sector_knowledge('sports', 'subramo', 'gym', 'Academia', null, 'sebrae', 10);
select public._upsert_sector_knowledge('sports', 'activity', 'sports_ops', 'Esporte e lazer', null, 'ibge', 10);
select public._upsert_sector_knowledge('sports', 'revenue', 'memberships', 'Mensalidades e aulas', null, 'sebrae', 10);
select public._upsert_sector_knowledge('sports', 'cost', 'coaches', 'Profissionais e estrutura', null, 'assoc_esporte', 10);
select public._upsert_sector_knowledge('sports', 'indicator', 'revenue_per_member', 'Receita por aluno/membro', null, 'sebrae', 10);

-- Beleza
select public._upsert_sector_knowledge('beauty', 'activity', 'beauty_care', 'Beleza e estética', null, 'abihpec', 10);
select public._upsert_sector_knowledge('beauty', 'product', 'beauty_services', 'Serviços de beleza', null, 'abihpec', 10);
select public._upsert_sector_knowledge('beauty', 'revenue', 'appointments', 'Atendimentos', null, 'sebrae', 10);
select public._upsert_sector_knowledge('beauty', 'cost', 'cosmetics', 'Produtos cosméticos', null, 'abihpec', 10);
select public._upsert_sector_knowledge('beauty', 'indicator', 'ticket_beauty', 'Ticket médio', null, 'sebrae', 10);

-- Profissionais
select public._upsert_sector_knowledge('professional', 'subramo', 'consulting', 'Consultoria', null, 'sebrae', 10);
select public._upsert_sector_knowledge('professional', 'subramo', 'law', 'Advocacia', null, 'conselhos_prof', 20);
select public._upsert_sector_knowledge('professional', 'activity', 'professional_services', 'Serviços profissionais', null, 'ibge', 10);
select public._upsert_sector_knowledge('professional', 'revenue', 'fees', 'Honorários', null, 'sebrae', 10);
select public._upsert_sector_knowledge('professional', 'cost', 'billable_hours', 'Horas e equipe técnica', null, 'conselhos_prof', 10);
select public._upsert_sector_knowledge('professional', 'indicator', 'utilization', 'Utilização de horas', null, 'sebrae', 10);

-- Meio ambiente
select public._upsert_sector_knowledge('environment', 'activity', 'environmental_services', 'Serviços ambientais', null, 'ibama', 10);
select public._upsert_sector_knowledge('environment', 'revenue', 'projects_licenses', 'Projetos e licenciamento', null, 'ibama', 10);
select public._upsert_sector_knowledge('environment', 'cost', 'field_ops', 'Operação de campo', null, 'ana', 10);
select public._upsert_sector_knowledge('environment', 'expense', 'compliance_env', 'Compliance ambiental', null, 'ibama', 10);
select public._upsert_sector_knowledge('environment', 'indicator', 'revenue_per_project', 'Receita por projeto', null, 'ibge', 10);

-- Administração pública
select public._upsert_sector_knowledge('public_admin', 'activity', 'public_management', 'Gestão pública', null, 'portal_transparencia', 10);
select public._upsert_sector_knowledge('public_admin', 'revenue', 'budget_allocation', 'Dotação orçamentária', null, 'tesouro_nacional', 10);
select public._upsert_sector_knowledge('public_admin', 'cost', 'program_execution', 'Execução de programas', null, 'portal_transparencia', 10);
select public._upsert_sector_knowledge('public_admin', 'expense', 'admin_public', 'Despesas administrativas', null, 'tesouro_nacional', 10);
select public._upsert_sector_knowledge('public_admin', 'indicator', 'budget_execution', 'Execução orçamentária', null, 'tesouro_nacional', 10);

-- Outros
select public._upsert_sector_knowledge('other', 'activity', 'general_ops', 'Operação econômica geral', null, 'ibge', 10);
select public._upsert_sector_knowledge('other', 'revenue', 'general_revenue', 'Receitas da atividade', null, 'sebrae', 10);
select public._upsert_sector_knowledge('other', 'cost', 'general_costs', 'Custos da atividade', null, 'sebrae', 10);
select public._upsert_sector_knowledge('other', 'expense', 'general_expenses', 'Despesas operacionais', null, 'ibge', 10);
select public._upsert_sector_knowledge('other', 'indicator', 'operating_margin', 'Margem operacional', null, 'ibge', 10);
select public._upsert_sector_knowledge('other', 'benchmark_metric', 'activity_specific', 'Indicadores específicos da atividade', 'Fontes escolhidas conforme a descrição informada', 'fontes_especificas', 10);

drop function if exists public._upsert_sector_knowledge(text, text, text, text, text, text, integer, jsonb);
