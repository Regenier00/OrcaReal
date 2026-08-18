import { BRAZIL_STATES, YES_NO, opts, q } from './helpers'
import type { ExperienceQuestion } from '../types'

const common: ExperienceQuestion[] = [
  q(
    {
      code: 'company_size',
      prompt: 'Qual é o porte da sua empresa?',
      helpText: 'Usamos isso para calibrar a profundidade dos indicadores.',
      options: opts('MEI', 'Microempresa', 'Pequena', 'Média', 'Grande'),
      mapsTo: 'profile.company_size',
    },
    10
  ),
  q(
    {
      code: 'employee_count',
      prompt:
        'Informe a quantidade de funcionários que a empresa possui para uma experiência personalizada',
      helpText:
        'Esse número preenche os indicadores de receita e custo por funcionário. Você pode alterar depois no perfil da empresa.',
      answerType: 'number',
      mapsTo: 'profile.employee_count',
    },
    20
  ),
  q(
    {
      code: 'state',
      prompt: 'Em qual estado a empresa está?',
      options: BRAZIL_STATES,
      mapsTo: 'profile.state',
      optional: true,
    },
    30
  ),
  q(
    {
      code: 'city',
      prompt: 'Qual é o município?',
      answerType: 'text',
      mapsTo: 'profile.city',
      optional: true,
    },
    40
  ),
  q(
    {
      code: 'revenue_model',
      prompt: 'Como sua empresa gera receita?',
      options: opts(
        'Venda de produtos',
        'Prestação de serviços',
        'Receita recorrente',
        'Contratos',
        'Produção e comercialização',
        'Mista'
      ),
      mapsTo: 'profile.revenue_model',
    },
    60
  ),
  q(
    {
      code: 'operation_model',
      prompt: 'Qual é o modelo de operação?',
      options: opts(
        'Operação própria',
        'Arrendada',
        'Terceirizada',
        'Mista',
        'Franquia'
      ),
      mapsTo: 'profile.operation_model',
    },
    70
  ),
  q(
    {
      code: 'extra_segments',
      prompt: 'Além do ramo principal, a empresa possui outras atividades?',
      helpText: 'Selecione os ramos adicionais. Cada operação terá indicadores próprios e os resultados também poderão ser consolidados.',
      answerType: 'multiple',
      optionSource: 'segments',
      mapsTo: 'operations',
      optional: true,
    },
    80
  ),
  q(
    {
      code: 'tracks_unit_costs',
      prompt: 'Você acompanha seus custos por unidade?',
      helpText: 'O indicador de custo por unidade do ramo aparece no dashboard. Informe a quantidade do mês ao clicar no card.',
      options: YES_NO,
      mapsTo: 'fact.tracks_unit_costs',
    },
    100
  ),
]

const agro: ExperienceQuestion[] = [
  q({ code: 'agro_crops', segmentCode: 'agro', prompt: 'Quais culturas sua empresa produz?', answerType: 'multiple', options: opts('Soja', 'Milho', 'Algodão', 'Café', 'Cana-de-açúcar', 'Trigo', 'Arroz', 'Hortaliças', 'Outra'), mapsTo: 'fact.crops' }, 110),
  q({ code: 'agro_hectares', segmentCode: 'agro', prompt: 'Quantos hectares são utilizados?', answerType: 'number', mapsTo: 'fact.hectares' }, 120),
  q({ code: 'agro_land_tenure', segmentCode: 'agro', prompt: 'A propriedade é própria ou arrendada?', options: opts('Própria', 'Arrendada', 'Mista'), mapsTo: 'fact.land_tenure' }, 130),
  q({ code: 'agro_productivity', segmentCode: 'agro', prompt: 'Qual é a produtividade média?', helpText: 'Informe o número na unidade que vocês já usam (saca/ha, t/ha, etc.).', answerType: 'number', optional: true, mapsTo: 'fact.avg_productivity' }, 140),
  q({ code: 'agro_production_unit', segmentCode: 'agro', prompt: 'Qual é a unidade utilizada para acompanhar sua produção?', options: opts('Hectare', 'Saca', 'Tonelada', 'Outra'), mapsTo: 'fact.production_unit' }, 150),
  q({ code: 'agro_tracks_cost_hectare', segmentCode: 'agro', prompt: 'A empresa acompanha custo por hectare?', options: YES_NO, mapsTo: 'fact.tracks_cost_hectare' }, 160),
  q({ code: 'agro_tracks_cost_crop', segmentCode: 'agro', prompt: 'Você acompanha o custo individual por cultura?', options: YES_NO, mapsTo: 'fact.tracks_cost_crop' }, 170),
  q({ code: 'agro_tracks_productivity_hectare', segmentCode: 'agro', prompt: 'Você acompanha produtividade por hectare?', options: YES_NO, mapsTo: 'fact.tracks_productivity_hectare' }, 175),
  q({ code: 'agro_estimated_production', segmentCode: 'agro', prompt: 'Qual é a produção estimada?', answerType: 'number', optional: true, mapsTo: 'fact.estimated_production' }, 180),
  q({ code: 'agro_avg_price', segmentCode: 'agro', prompt: 'Qual é o preço médio de venda?', answerType: 'number', optional: true, mapsTo: 'fact.avg_sale_price' }, 190),
  q({ code: 'agro_inputs', segmentCode: 'agro', prompt: 'Quais são os principais insumos?', answerType: 'multiple', options: opts('Sementes', 'Fertilizantes', 'Defensivos', 'Combustível', 'Mão de obra', 'Outros'), mapsTo: 'fact.main_inputs' }, 200),
  q({ code: 'agro_own_machinery', segmentCode: 'agro', prompt: 'Existe maquinário próprio?', options: YES_NO, mapsTo: 'fact.own_machinery' }, 210),
  q({ code: 'agro_third_party', segmentCode: 'agro', prompt: 'Existe contratação de serviços de terceiros?', options: YES_NO, mapsTo: 'fact.third_party_services' }, 220),
  q({ code: 'agro_financing', segmentCode: 'agro', prompt: 'Existe financiamento agrícola?', options: YES_NO, mapsTo: 'fact.agricultural_financing' }, 230),
  q({ code: 'agro_track_arroba_like', segmentCode: 'agro', prompt: 'Você deseja acompanhar o custo por saca?', options: YES_NO, continuous: true, optional: true, mapsTo: 'fact.wants_cost_per_bag' }, 900),
]

const livestock: ExperienceQuestion[] = [
  q({ code: 'pec_type', segmentCode: 'livestock', prompt: 'Qual é o tipo de pecuária?', options: opts('Bovinocultura', 'Avicultura', 'Suinocultura', 'Ovinocultura', 'Outra'), mapsTo: 'fact.livestock_type' }, 110),
  q({ code: 'pec_kind', segmentCode: 'livestock', prompt: 'A atividade é de corte, leite ou outra?', options: opts('Corte', 'Leite', 'Mista', 'Outro'), mapsTo: 'fact.livestock_kind' }, 120),
  q({ code: 'pec_animals', segmentCode: 'livestock', prompt: 'Qual é a quantidade de animais?', answerType: 'number', mapsTo: 'fact.animal_count' }, 130),
  q({ code: 'pec_properties', segmentCode: 'livestock', prompt: 'Quantas propriedades a empresa utiliza?', answerType: 'number', optional: true, mapsTo: 'fact.property_count' }, 140),
  q({ code: 'pec_lots', segmentCode: 'livestock', prompt: 'Qual é a quantidade de lotes?', answerType: 'number', optional: true, mapsTo: 'fact.lot_count' }, 150),
  q({ code: 'pec_area', segmentCode: 'livestock', prompt: 'Qual é a área utilizada (hectares)?', answerType: 'number', optional: true, mapsTo: 'fact.area_hectares' }, 160),
  q({ code: 'pec_system', segmentCode: 'livestock', prompt: 'Qual é o sistema de criação?', options: opts('Pasto', 'Confinamento', 'Semi-confinamento', 'Misto'), mapsTo: 'fact.breeding_system' }, 170),
  q({ code: 'pec_avg_weight', segmentCode: 'livestock', prompt: 'Qual é o peso médio dos animais?', answerType: 'number', optional: true, mapsTo: 'fact.avg_weight' }, 180),
  q({ code: 'pec_arroba', segmentCode: 'livestock', prompt: 'Qual é a produção de arrobas?', answerType: 'number', optional: true, mapsTo: 'fact.arroba_production' }, 190),
  q({ code: 'pec_milk', segmentCode: 'livestock', prompt: 'Qual é a produção de leite?', answerType: 'number', optional: true, mapsTo: 'fact.milk_production', showWhen: { in: { answer: 'pec_kind', values: ['leite', 'mista'] } } }, 200),
  q({ code: 'pec_cost_animal', segmentCode: 'livestock', prompt: 'Qual é o custo médio por animal?', answerType: 'number', optional: true, mapsTo: 'fact.avg_cost_per_animal' }, 210),
  q({ code: 'pec_costs', segmentCode: 'livestock', prompt: 'Quais custos são mais importantes para sua atividade?', answerType: 'multiple', options: opts('Alimentação', 'Medicamentos', 'Mão de obra', 'Pastagem', 'Reprodução', 'Compra de animais', 'Manutenção'), mapsTo: 'fact.main_costs' }, 220),
  q({ code: 'pec_buy_sell', segmentCode: 'livestock', prompt: 'A empresa compra e vende animais com frequência?', options: YES_NO, mapsTo: 'fact.animal_buy_sell' }, 230),
  q({ code: 'pec_tracks_lot', segmentCode: 'livestock', prompt: 'Você controla o custo por lote?', options: YES_NO, mapsTo: 'fact.tracks_cost_lot' }, 240),
  q({ code: 'pec_tracks_animal', segmentCode: 'livestock', prompt: 'Você controla o custo por animal?', options: YES_NO, mapsTo: 'fact.tracks_cost_animal' }, 250),
  q({ code: 'pec_wants_arroba', segmentCode: 'livestock', prompt: 'Você deseja acompanhar o custo por arroba?', options: YES_NO, continuous: true, optional: true, mapsTo: 'fact.wants_cost_per_arroba' }, 910),
]

const fishing: ExperienceQuestion[] = [
  q({ code: 'fish_type', segmentCode: 'fishing', prompt: 'Qual é o tipo de operação?', options: opts('Pesca', 'Piscicultura', 'Aquicultura', 'Mista'), mapsTo: 'fact.fishing_type' }, 110),
  q({ code: 'fish_species', segmentCode: 'fishing', prompt: 'Quais espécies são produzidas ou capturadas?', answerType: 'multiple', options: opts('Tilápia', 'Tambaqui', 'Camarão', 'Peixes nativos', 'Outra'), mapsTo: 'fact.species' }, 120),
  q({ code: 'fish_volume', segmentCode: 'fishing', prompt: 'Qual é o volume produzido?', answerType: 'number', optional: true, mapsTo: 'fact.volume' }, 130),
  q({ code: 'fish_area', segmentCode: 'fishing', prompt: 'Qual é a área ou lâmina d’água utilizada?', answerType: 'number', optional: true, mapsTo: 'fact.water_area' }, 140),
  q({ code: 'fish_feed', segmentCode: 'fishing', prompt: 'A ração é um custo relevante?', options: YES_NO, mapsTo: 'fact.feed_is_relevant' }, 150),
]

const commerce: ExperienceQuestion[] = [
  q({ code: 'com_type', segmentCode: 'commerce', prompt: 'Qual é o tipo de comércio?', options: opts('Varejo', 'Atacado', 'Distribuição', 'E-commerce', 'Misto'), mapsTo: 'fact.commerce_type' }, 110),
  q({ code: 'com_stores', segmentCode: 'commerce', prompt: 'Quantas lojas a empresa possui?', answerType: 'number', optional: true, mapsTo: 'fact.store_count' }, 120),
  q({ code: 'com_products', segmentCode: 'commerce', prompt: 'Qual é a quantidade aproximada de produtos?', answerType: 'number', optional: true, mapsTo: 'fact.product_count' }, 130),
  q({ code: 'com_categories', segmentCode: 'commerce', prompt: 'Quais categorias de produtos são mais relevantes?', answerType: 'multiple', options: opts('Alimentos', 'Bebidas', 'Vestuário', 'Eletrônicos', 'Construção', 'Agropecuários', 'Outras'), mapsTo: 'fact.product_categories' }, 140),
  q({ code: 'com_channel', segmentCode: 'commerce', prompt: 'A venda é física, online ou ambas?', options: opts('Física', 'Online', 'Ambas'), mapsTo: 'fact.sales_channel' }, 150),
  q({ code: 'com_ticket', segmentCode: 'commerce', prompt: 'Qual é o ticket médio?', answerType: 'number', optional: true, mapsTo: 'fact.avg_ticket' }, 160),
  q({ code: 'com_volume', segmentCode: 'commerce', prompt: 'Qual é o volume médio de vendas?', answerType: 'number', optional: true, mapsTo: 'fact.sales_volume' }, 170),
  q({ code: 'com_stock', segmentCode: 'commerce', prompt: 'A empresa controla estoque?', options: YES_NO, mapsTo: 'fact.stock_control' }, 180),
  q({ code: 'com_costs', segmentCode: 'commerce', prompt: 'Quais custos pesam mais nas vendas?', answerType: 'multiple', options: opts('Aquisição', 'Frete', 'Impostos sobre vendas', 'Comissões', 'Descontos', 'Devoluções'), mapsTo: 'fact.main_costs' }, 190),
]

const industry: ExperienceQuestion[] = [
  q({ code: 'ind_type', segmentCode: 'industry', prompt: 'Qual é o tipo de indústria?', options: opts('Alimentos', 'Metalúrgica', 'Química', 'Têxtil', 'Móveis', 'Outra'), mapsTo: 'fact.industry_type' }, 110),
  q({ code: 'ind_products', segmentCode: 'industry', prompt: 'Quais produtos são fabricados?', answerType: 'text', mapsTo: 'fact.manufactured_products' }, 120),
  q({ code: 'ind_volume', segmentCode: 'industry', prompt: 'Qual é o volume de produção?', answerType: 'number', optional: true, mapsTo: 'fact.production_volume' }, 130),
  q({ code: 'ind_capacity', segmentCode: 'industry', prompt: 'Qual é a capacidade produtiva?', answerType: 'number', optional: true, mapsTo: 'fact.capacity' }, 140),
  q({ code: 'ind_inputs', segmentCode: 'industry', prompt: 'Quais matérias-primas são mais relevantes?', answerType: 'text', optional: true, mapsTo: 'fact.raw_materials' }, 150),
  q({ code: 'ind_costs', segmentCode: 'industry', prompt: 'Quais custos de produção você acompanha?', answerType: 'multiple', options: opts('Matéria-prima', 'Mão de obra direta', 'Custos indiretos', 'Máquinas', 'Horas de produção', 'Perdas e desperdícios'), mapsTo: 'fact.production_costs' }, 160),
  q({ code: 'ind_stock_rm', segmentCode: 'industry', prompt: 'A empresa controla estoque de matéria-prima?', options: YES_NO, mapsTo: 'fact.raw_material_stock' }, 170),
  q({ code: 'ind_stock_fg', segmentCode: 'industry', prompt: 'A empresa controla estoque de produtos acabados?', options: YES_NO, mapsTo: 'fact.finished_goods_stock' }, 180),
]

const construction: ExperienceQuestion[] = [
  q({ code: 'con_works', segmentCode: 'construction', prompt: 'Quantas obras estão ativas?', answerType: 'number', mapsTo: 'fact.work_count' }, 110),
  q({ code: 'con_type', segmentCode: 'construction', prompt: 'Qual é o tipo de obras?', options: opts('Residencial', 'Comercial', 'Infraestrutura', 'Reforma', 'Mista'), mapsTo: 'fact.work_type' }, 120),
  q({ code: 'con_area', segmentCode: 'construction', prompt: 'Qual é a área construída (m²)?', answerType: 'number', optional: true, mapsTo: 'fact.built_area' }, 130),
  q({ code: 'con_value', segmentCode: 'construction', prompt: 'Qual é o valor contratado?', answerType: 'number', optional: true, mapsTo: 'fact.contract_value' }, 140),
  q({ code: 'con_deadline', segmentCode: 'construction', prompt: 'Qual é o prazo médio das obras (meses)?', answerType: 'number', optional: true, mapsTo: 'fact.deadline_months' }, 150),
  q({ code: 'con_costs', segmentCode: 'construction', prompt: 'Quais custos você acompanha por obra?', answerType: 'multiple', options: opts('Materiais', 'Mão de obra', 'Terceirizados', 'Equipamentos', 'Custos indiretos', 'Etapas da obra'), mapsTo: 'fact.work_costs' }, 160),
]

const transport: ExperienceQuestion[] = [
  q({ code: 'trn_vehicles', segmentCode: 'transport_logistics', prompt: 'Qual é a quantidade de veículos?', answerType: 'number', mapsTo: 'fact.vehicle_count' }, 110),
  q({ code: 'trn_type', segmentCode: 'transport_logistics', prompt: 'Qual é o tipo de veículos?', options: opts('Caminhão', 'Van', 'Carreta', 'Utilitário', 'Misto'), mapsTo: 'fact.vehicle_type' }, 120),
  q({ code: 'trn_km', segmentCode: 'transport_logistics', prompt: 'Qual é a quilometragem média?', answerType: 'number', optional: true, mapsTo: 'fact.avg_km' }, 130),
  q({ code: 'trn_trips', segmentCode: 'transport_logistics', prompt: 'Qual é a quantidade de viagens?', answerType: 'number', optional: true, mapsTo: 'fact.trip_count' }, 140),
  q({ code: 'trn_capacity', segmentCode: 'transport_logistics', prompt: 'Qual é a capacidade de carga?', answerType: 'number', optional: true, mapsTo: 'fact.load_capacity' }, 150),
  q({ code: 'trn_tons', segmentCode: 'transport_logistics', prompt: 'Quantas toneladas são transportadas?', answerType: 'number', optional: true, mapsTo: 'fact.transported_tons' }, 160),
  q({ code: 'trn_costs', segmentCode: 'transport_logistics', prompt: 'Quais custos são mais importantes?', answerType: 'multiple', options: opts('Combustível', 'Manutenção', 'Pedágios', 'Motoristas', 'Terceirização'), mapsTo: 'fact.main_costs' }, 170),
]

const food: ExperienceQuestion[] = [
  q({ code: 'food_type', segmentCode: 'food', prompt: 'Qual é o tipo de estabelecimento?', options: opts('Restaurante', 'Lanchonete', 'Padaria', 'Dark kitchen', 'Buffet', 'Outro'), mapsTo: 'fact.food_type' }, 110),
  q({ code: 'food_units', segmentCode: 'food', prompt: 'Quantas unidades a empresa possui?', answerType: 'number', optional: true, mapsTo: 'fact.unit_count' }, 120),
  q({ code: 'food_products', segmentCode: 'food', prompt: 'Quais produtos são mais vendidos?', answerType: 'text', optional: true, mapsTo: 'fact.sold_products' }, 130),
  q({ code: 'food_orders', segmentCode: 'food', prompt: 'Qual é o número médio de pedidos?', answerType: 'number', optional: true, mapsTo: 'fact.avg_orders' }, 140),
  q({ code: 'food_ticket', segmentCode: 'food', prompt: 'Qual é o ticket médio?', answerType: 'number', optional: true, mapsTo: 'fact.avg_ticket' }, 150),
  q({ code: 'food_costs', segmentCode: 'food', prompt: 'Quais custos você quer acompanhar?', answerType: 'multiple', options: opts('Ingredientes', 'Desperdícios', 'Funcionários', 'Delivery', 'Taxas de aplicativos', 'Embalagem'), mapsTo: 'fact.main_costs' }, 160),
  q({ code: 'food_delivery', segmentCode: 'food', prompt: 'A empresa trabalha com delivery?', options: YES_NO, mapsTo: 'fact.has_delivery' }, 170),
]

const services: ExperienceQuestion[] = [
  q({ code: 'srv_type', segmentCode: 'services', prompt: 'Qual é o tipo de serviço?', answerType: 'text', mapsTo: 'fact.service_type' }, 110),
  q({ code: 'srv_clients', segmentCode: 'services', prompt: 'Qual é a quantidade de clientes?', answerType: 'number', optional: true, mapsTo: 'fact.client_count' }, 120),
  q({ code: 'srv_contracts', segmentCode: 'services', prompt: 'Qual é a quantidade de contratos?', answerType: 'number', optional: true, mapsTo: 'fact.contract_count' }, 130),
  q({ code: 'srv_projects', segmentCode: 'services', prompt: 'Quantos projetos são realizados?', answerType: 'number', optional: true, mapsTo: 'fact.project_count' }, 140),
  q({ code: 'srv_hours', segmentCode: 'services', prompt: 'Qual é o volume de horas trabalhadas?', answerType: 'number', optional: true, mapsTo: 'fact.worked_hours' }, 150),
  q({ code: 'srv_avg_contract', segmentCode: 'services', prompt: 'Qual é o valor médio dos contratos?', answerType: 'number', optional: true, mapsTo: 'fact.avg_contract_value' }, 160),
  q({ code: 'srv_costs', segmentCode: 'services', prompt: 'Quais custos por projeto são acompanhados?', answerType: 'multiple', options: opts('Pessoal', 'Terceirizados', 'Deslocamento', 'Ferramentas', 'Outros'), mapsTo: 'fact.project_costs' }, 170),
]

const tech: ExperienceQuestion[] = [
  q({ code: 'tech_type', segmentCode: 'tech', prompt: 'Qual é o tipo da empresa?', options: opts('SaaS', 'Software sob demanda', 'Consultoria de TI', 'Produto digital', 'Mista'), mapsTo: 'fact.tech_type' }, 110),
  q({ code: 'tech_offer', segmentCode: 'tech', prompt: 'A empresa vende produtos, serviços ou ambos?', options: opts('Produtos', 'Serviços', 'Ambos'), mapsTo: 'fact.offer_type' }, 120),
  q({ code: 'tech_model', segmentCode: 'tech', prompt: 'O modelo é SaaS ou projetos?', options: opts('SaaS', 'Projetos', 'Híbrido'), mapsTo: 'fact.delivery_model' }, 130),
  q({ code: 'tech_clients', segmentCode: 'tech', prompt: 'Qual é o número de clientes?', answerType: 'number', optional: true, mapsTo: 'fact.client_count' }, 140),
  q({ code: 'tech_users', segmentCode: 'tech', prompt: 'Qual é o número de usuários?', answerType: 'number', optional: true, mapsTo: 'fact.user_count' }, 150),
  q({ code: 'tech_projects', segmentCode: 'tech', prompt: 'Quantos projetos estão ativos?', answerType: 'number', optional: true, mapsTo: 'fact.active_projects' }, 160),
  q({ code: 'tech_hours', segmentCode: 'tech', prompt: 'Qual é o volume de horas trabalhadas?', answerType: 'number', optional: true, mapsTo: 'fact.worked_hours' }, 170),
  q({ code: 'tech_recurring', segmentCode: 'tech', prompt: 'A empresa possui receita recorrente?', options: YES_NO, mapsTo: 'fact.has_recurring_revenue' }, 190),
]

const health: ExperienceQuestion[] = [
  q({ code: 'hlt_type', segmentCode: 'health', prompt: 'Qual é o tipo de estabelecimento?', options: opts('Clínica', 'Consultório', 'Hospital', 'Laboratório', 'Outro'), mapsTo: 'fact.health_type' }, 110),
  q({ code: 'hlt_units', segmentCode: 'health', prompt: 'Quantas unidades a empresa possui?', answerType: 'number', optional: true, mapsTo: 'fact.unit_count' }, 120),
  q({ code: 'hlt_pros', segmentCode: 'health', prompt: 'Quantos profissionais atuam na operação?', answerType: 'number', optional: true, mapsTo: 'fact.professional_count' }, 130),
  q({ code: 'hlt_volume', segmentCode: 'health', prompt: 'O que a empresa acompanha no atendimento?', answerType: 'multiple', options: opts('Consultas', 'Procedimentos', 'Pacientes', 'Convênios'), mapsTo: 'fact.health_volume' }, 140),
]

const education: ExperienceQuestion[] = [
  q({ code: 'edu_type', segmentCode: 'education', prompt: 'Qual é o tipo de instituição?', options: opts('Escola', 'Curso livre', 'Faculdade', 'Treinamento corporativo', 'Outro'), mapsTo: 'fact.education_type' }, 110),
  q({ code: 'edu_students', segmentCode: 'education', prompt: 'Qual é o número de alunos?', answerType: 'number', mapsTo: 'fact.student_count' }, 120),
  q({ code: 'edu_courses', segmentCode: 'education', prompt: 'Quantos cursos são oferecidos?', answerType: 'number', optional: true, mapsTo: 'fact.course_count' }, 130),
  q({ code: 'edu_classes', segmentCode: 'education', prompt: 'Quantas turmas estão ativas?', answerType: 'number', optional: true, mapsTo: 'fact.class_count' }, 140),
  q({ code: 'edu_teachers', segmentCode: 'education', prompt: 'Quantos professores atuam na instituição?', answerType: 'number', optional: true, mapsTo: 'fact.teacher_count' }, 150),
  q({ code: 'edu_tuition', segmentCode: 'education', prompt: 'Qual é a mensalidade média?', answerType: 'number', optional: true, mapsTo: 'fact.avg_tuition' }, 160),
]

const realEstate: ExperienceQuestion[] = [
  q({ code: 're_model', segmentCode: 'real_estate', prompt: 'A operação é de compra e venda ou aluguel?', options: opts('Compra e venda', 'Aluguel', 'Ambas', 'Administração predial'), mapsTo: 'fact.real_estate_model' }, 110),
  q({ code: 're_properties', segmentCode: 'real_estate', prompt: 'Qual é a quantidade de imóveis?', answerType: 'number', mapsTo: 'fact.property_count' }, 120),
  q({ code: 're_contracts', segmentCode: 'real_estate', prompt: 'Qual é a quantidade de contratos?', answerType: 'number', optional: true, mapsTo: 'fact.contract_count' }, 130),
  q({ code: 're_avg_value', segmentCode: 'real_estate', prompt: 'Qual é o valor médio dos imóveis?', answerType: 'number', optional: true, mapsTo: 'fact.avg_property_value' }, 140),
  q({ code: 're_costs', segmentCode: 'real_estate', prompt: 'Quais custos você acompanha por imóvel?', answerType: 'multiple', options: opts('Manutenção', 'Condomínio', 'Impostos', 'Vacância', 'Comissões'), mapsTo: 'fact.property_costs' }, 150),
]

const automotive: ExperienceQuestion[] = [
  q({ code: 'auto_type', segmentCode: 'automotive', prompt: 'Qual é o tipo de operação?', options: opts('Oficina', 'Concessionária', 'Peças', 'Estética automotiva', 'Mista'), mapsTo: 'fact.auto_type' }, 110),
  q({ code: 'auto_vehicles', segmentCode: 'automotive', prompt: 'Quantos veículos são atendidos?', answerType: 'number', optional: true, mapsTo: 'fact.vehicles_served' }, 120),
  q({ code: 'auto_services', segmentCode: 'automotive', prompt: 'Quais serviços são realizados?', answerType: 'multiple', options: opts('Manutenção', 'Funilaria', 'Estética', 'Venda de peças', 'Venda de veículos'), mapsTo: 'fact.auto_services' }, 130),
  q({ code: 'auto_ticket', segmentCode: 'automotive', prompt: 'Qual é o ticket médio?', answerType: 'number', optional: true, mapsTo: 'fact.avg_ticket' }, 140),
  q({ code: 'auto_stock', segmentCode: 'automotive', prompt: 'A empresa controla estoque de peças?', options: YES_NO, mapsTo: 'fact.parts_stock' }, 150),
]

const energy: ExperienceQuestion[] = [
  q({ code: 'eng_type', segmentCode: 'energy', prompt: 'Qual é o tipo de geração ou operação?', options: opts('Solar', 'Eólica', 'Hidrelétrica', 'Distribuição', 'Eficiência energética', 'Outra'), mapsTo: 'fact.energy_type' }, 110),
  q({ code: 'eng_capacity', segmentCode: 'energy', prompt: 'Qual é a capacidade instalada?', answerType: 'number', optional: true, mapsTo: 'fact.installed_capacity' }, 120),
  q({ code: 'eng_units', segmentCode: 'energy', prompt: 'Quantas unidades fazem parte da operação?', answerType: 'number', optional: true, mapsTo: 'fact.unit_count' }, 130),
  q({ code: 'eng_production', segmentCode: 'energy', prompt: 'Qual é a produção (kWh)?', answerType: 'number', optional: true, mapsTo: 'fact.production_kwh' }, 140),
  q({ code: 'eng_costs', segmentCode: 'energy', prompt: 'Quais custos operacionais são acompanhados?', answerType: 'multiple', options: opts('Manutenção', 'Equipamentos', 'Pessoal', 'Transmissão'), mapsTo: 'fact.main_costs' }, 150),
]

const mining: ExperienceQuestion[] = [
  q({ code: 'min_type', segmentCode: 'mining', prompt: 'Qual é o tipo de mineral?', answerType: 'text', mapsTo: 'fact.mineral_type' }, 110),
  q({ code: 'min_sites', segmentCode: 'mining', prompt: 'Quais localidades são exploradas?', answerType: 'text', optional: true, mapsTo: 'fact.sites' }, 120),
  q({ code: 'min_area', segmentCode: 'mining', prompt: 'Qual é a área explorada?', answerType: 'number', optional: true, mapsTo: 'fact.explored_area' }, 130),
  q({ code: 'min_volume', segmentCode: 'mining', prompt: 'Qual é o volume extraído?', answerType: 'number', optional: true, mapsTo: 'fact.extracted_volume' }, 140),
]

const hospitality: ExperienceQuestion[] = [
  q({ code: 'hot_rooms', segmentCode: 'hospitality', prompt: 'Qual é o número de quartos?', answerType: 'number', mapsTo: 'fact.room_count' }, 110),
  q({ code: 'hot_capacity', segmentCode: 'hospitality', prompt: 'Qual é a capacidade de hóspedes?', answerType: 'number', optional: true, mapsTo: 'fact.capacity' }, 120),
  q({ code: 'hot_occupancy', segmentCode: 'hospitality', prompt: 'Qual é a taxa média de ocupação (%)?', answerType: 'number', optional: true, mapsTo: 'fact.avg_occupancy' }, 130),
  q({ code: 'hot_rate', segmentCode: 'hospitality', prompt: 'Qual é a diária média?', answerType: 'number', optional: true, mapsTo: 'fact.avg_daily_rate' }, 140),
  q({ code: 'hot_services', segmentCode: 'hospitality', prompt: 'Quais serviços adicionais existem?', answerType: 'multiple', options: opts('Restaurante', 'Eventos', 'Spa', 'Transfers', 'Nenhum'), mapsTo: 'fact.extra_services' }, 150),
  q({ code: 'hot_platforms', segmentCode: 'hospitality', prompt: 'Há comissões de plataformas de reserva?', options: YES_NO, mapsTo: 'fact.platform_commissions' }, 160),
]

const beauty: ExperienceQuestion[] = [
  q({ code: 'beau_pros', segmentCode: 'beauty', prompt: 'Quantos profissionais atuam no negócio?', answerType: 'number', mapsTo: 'fact.professional_count' }, 110),
  q({ code: 'beau_services', segmentCode: 'beauty', prompt: 'Quais serviços são oferecidos?', answerType: 'multiple', options: opts('Cabelo', 'Estética', 'Unhas', 'Barbearia', 'Outros'), mapsTo: 'fact.beauty_services' }, 120),
  q({ code: 'beau_attendances', segmentCode: 'beauty', prompt: 'Qual é o número de atendimentos?', answerType: 'number', optional: true, mapsTo: 'fact.attendance_count' }, 130),
  q({ code: 'beau_ticket', segmentCode: 'beauty', prompt: 'Qual é o ticket médio?', answerType: 'number', optional: true, mapsTo: 'fact.avg_ticket' }, 140),
  q({ code: 'beau_costs', segmentCode: 'beauty', prompt: 'Quais custos você acompanha?', answerType: 'multiple', options: opts('Produtos', 'Comissões', 'Aluguel', 'Horas disponíveis'), mapsTo: 'fact.main_costs' }, 150),
]

const media: ExperienceQuestion[] = [
  q({ code: 'media_clients', segmentCode: 'media', prompt: 'Quantos clientes a empresa atende?', answerType: 'number', optional: true, mapsTo: 'fact.client_count' }, 110),
  q({ code: 'media_projects', segmentCode: 'media', prompt: 'Quantos projetos ou campanhas estão ativos?', answerType: 'number', optional: true, mapsTo: 'fact.project_count' }, 120),
]

const marketing: ExperienceQuestion[] = [
  q({ code: 'mkt_clients', segmentCode: 'marketing', prompt: 'Quantos clientes a agência atende?', answerType: 'number', optional: true, mapsTo: 'fact.client_count' }, 110),
  q({ code: 'mkt_projects', segmentCode: 'marketing', prompt: 'Quantos projetos ou campanhas estão ativos?', answerType: 'number', optional: true, mapsTo: 'fact.project_count' }, 120),
  q({ code: 'mkt_recurring', segmentCode: 'marketing', prompt: 'Há contratos recorrentes?', options: YES_NO, mapsTo: 'fact.has_recurring_contracts' }, 130),
  q({ code: 'mkt_costs', segmentCode: 'marketing', prompt: 'Quais custos você quer acompanhar?', answerType: 'multiple', options: opts('Pessoal', 'Horas', 'Terceirizados', 'Mídia'), mapsTo: 'fact.main_costs' }, 140),
]

const entertainment: ExperienceQuestion[] = [
  q({ code: 'ent_type', segmentCode: 'entertainment', prompt: 'Qual é o tipo de negócio?', options: opts('Casa de shows', 'Teatro', 'Produtora', 'Espaço cultural', 'Outro'), mapsTo: 'fact.entertainment_type' }, 110),
  q({ code: 'ent_events', segmentCode: 'entertainment', prompt: 'Qual é o número de eventos?', answerType: 'number', optional: true, mapsTo: 'fact.event_count' }, 120),
  q({ code: 'ent_capacity', segmentCode: 'entertainment', prompt: 'Qual é a capacidade do espaço?', answerType: 'number', optional: true, mapsTo: 'fact.capacity' }, 130),
  q({ code: 'ent_ticket', segmentCode: 'entertainment', prompt: 'Qual é o ticket médio?', answerType: 'number', optional: true, mapsTo: 'fact.avg_ticket' }, 140),
]

const sports: ExperienceQuestion[] = [
  q({ code: 'spt_type', segmentCode: 'sports', prompt: 'Qual é o tipo de negócio?', options: opts('Academia', 'Clube', 'Escola esportiva', 'Arena', 'Outro'), mapsTo: 'fact.sports_type' }, 110),
  q({ code: 'spt_clients', segmentCode: 'sports', prompt: 'Qual é o número de clientes ou alunos?', answerType: 'number', optional: true, mapsTo: 'fact.client_count' }, 120),
  q({ code: 'spt_events', segmentCode: 'sports', prompt: 'A empresa realiza eventos?', options: YES_NO, mapsTo: 'fact.has_events' }, 130),
  q({ code: 'spt_ticket', segmentCode: 'sports', prompt: 'Qual é o ticket médio?', answerType: 'number', optional: true, mapsTo: 'fact.avg_ticket' }, 140),
]

const environment: ExperienceQuestion[] = [
  q({ code: 'env_type', segmentCode: 'environment', prompt: 'Qual é o tipo de serviço ambiental?', options: opts('Gestão de resíduos', 'Consultoria', 'Licenciamento', 'Reciclagem', 'Outro'), mapsTo: 'fact.environment_type' }, 110),
  q({ code: 'env_projects', segmentCode: 'environment', prompt: 'Quantos projetos estão ativos?', answerType: 'number', optional: true, mapsTo: 'fact.project_count' }, 120),
  q({ code: 'env_volume', segmentCode: 'environment', prompt: 'Qual é o volume processado?', answerType: 'number', optional: true, mapsTo: 'fact.processed_volume' }, 130),
  q({ code: 'env_costs', segmentCode: 'environment', prompt: 'Quais custos operacionais são acompanhados?', answerType: 'multiple', options: opts('Equipes', 'Equipamentos', 'Transporte', 'Destinação'), mapsTo: 'fact.main_costs' }, 140),
]

const financial: ExperienceQuestion[] = [
  q({ code: 'fin_type', segmentCode: 'financial', prompt: 'Qual é o tipo de serviço financeiro?', options: opts('Correspondente', 'Seguros', 'Crédito', 'Consultoria', 'Outro'), mapsTo: 'fact.financial_type' }, 110),
  q({ code: 'fin_clients', segmentCode: 'financial', prompt: 'Qual é a quantidade de clientes?', answerType: 'number', optional: true, mapsTo: 'fact.client_count' }, 120),
  q({ code: 'fin_contracts', segmentCode: 'financial', prompt: 'Qual é a quantidade de contratos?', answerType: 'number', optional: true, mapsTo: 'fact.contract_count' }, 130),
]

const professional: ExperienceQuestion[] = [
  q({ code: 'pro_type', segmentCode: 'professional', prompt: 'Qual é o tipo de serviço profissional?', options: opts('Consultoria', 'Advocacia', 'Contabilidade', 'Engenharia', 'Outro'), mapsTo: 'fact.professional_type' }, 110),
  q({ code: 'pro_clients', segmentCode: 'professional', prompt: 'Qual é a quantidade de clientes?', answerType: 'number', optional: true, mapsTo: 'fact.client_count' }, 120),
  q({ code: 'pro_hours', segmentCode: 'professional', prompt: 'As horas trabalhadas são controladas?', options: YES_NO, mapsTo: 'fact.tracks_hours' }, 130),
]

const publicAdmin: ExperienceQuestion[] = [
  q({ code: 'pub_type', segmentCode: 'public_admin', prompt: 'Qual é o tipo de órgão ou entidade?', answerType: 'text', mapsTo: 'fact.public_type' }, 110),
  q({ code: 'pub_units', segmentCode: 'public_admin', prompt: 'Quantas unidades administrativas existem?', answerType: 'number', optional: true, mapsTo: 'fact.unit_count' }, 120),
  q({ code: 'pub_budget', segmentCode: 'public_admin', prompt: 'O acompanhamento principal é orçamentário?', options: YES_NO, mapsTo: 'fact.budget_focus' }, 130),
]

const other: ExperienceQuestion[] = [
  q({ code: 'oth_activity', segmentCode: 'other', prompt: 'Como você descreveria a operação principal?', answerType: 'text', mapsTo: 'fact.other_activity' }, 110),
  q({ code: 'oth_costs', segmentCode: 'other', prompt: 'Quais custos são mais importantes?', answerType: 'multiple', options: opts('Pessoal', 'Insumos', 'Serviços de terceiros', 'Estrutura', 'Impostos'), mapsTo: 'fact.main_costs' }, 120),
]

export const QUESTIONS: ExperienceQuestion[] = [
  ...common,
  ...agro,
  ...livestock,
  ...fishing,
  ...commerce,
  ...industry,
  ...construction,
  ...transport,
  ...food,
  ...services,
  ...tech,
  ...health,
  ...education,
  ...realEstate,
  ...automotive,
  ...energy,
  ...mining,
  ...hospitality,
  ...beauty,
  ...media,
  ...marketing,
  ...entertainment,
  ...sports,
  ...environment,
  ...financial,
  ...professional,
  ...publicAdmin,
  ...other,
]
