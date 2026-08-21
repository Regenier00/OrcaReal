import { BRAZIL_STATES, YES_NO, opts, q } from './helpers.ts'
import { REVENUE_MODEL_OPTIONS } from './revenueModels.ts'
import { OPERATION_MODEL_OPTIONS, OPERATION_MODELS } from './operationModels.ts'
import { SALES_CHANNEL_OPTIONS } from './salesChannels.ts'
import type { ExperienceQuestion } from '../types.ts'

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
      helpText:
        'Pode marcar mais de uma. Para cada forma escolhida, criamos indicadores de receita no dashboard — por exemplo, valor médio de venda para quem vende produtos.',
      answerType: 'multiple',
      options: REVENUE_MODEL_OPTIONS,
      mapsTo: 'profile.revenue_model',
    },
    60
  ),
  q(
    {
      code: 'operation_model',
      prompt: 'Qual é o modelo de operação?',
      options: OPERATION_MODEL_OPTIONS,
      mapsTo: 'profile.operation_model',
    },
    70
  ),
  q(
    {
      code: 'operation_priorities',
      prompt: 'Selecione quais informações são mais importantes para sua empresa?',
      helpText:
        'Marque os indicadores do seu modelo de operação. Eles aparecem em Indicadores operacionais e podem ser alterados depois no perfil da empresa.',
      answerType: 'multiple',
      optionSource: 'operation_indicators',
      optionLayout: 'cards',
      mapsTo: 'fact.operation_priorities',
      optional: true,
      showWhen: {
        in: {
          answer: 'operation_model',
          values: OPERATION_MODELS.flatMap((model) => [model.value, ...model.aliases]),
        },
      },
    },
    75
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
      code: 'products_offered',
      prompt: 'Qual produto ou tipo de serviço a empresa vende?',
      helpText:
        'As opções vêm do ramo e das outras operações, com base nas fontes setoriais. Pode marcar mais de um. Se não encontrar, marque Outro.',
      answerType: 'multiple',
      optionSource: 'sector_products',
      mapsTo: 'fact.products_offered',
    },
    90
  ),
  q(
    {
      code: 'products_other_describe',
      prompt: 'Descreva o produto ou serviço que a empresa vende',
      helpText:
        'Com a descrição, buscamos novamente nas fontes do seu ramo opções relacionadas.',
      answerType: 'text',
      mapsTo: 'fact.products_other_describe',
      showWhen: { includes: { answer: 'products_offered', value: 'outro' } },
    },
    91
  ),
  q(
    {
      code: 'products_other_matches',
      prompt: 'Encontramos estas opções relacionadas. Quais se encaixam?',
      helpText:
        'Selecione as que correspondem à descrição. Se nenhuma servir, pule e usamos o texto informado.',
      answerType: 'multiple',
      optionSource: 'sector_products_query',
      mapsTo: 'fact.products_other_matches',
      optional: true,
      showWhen: {
        all: [
          { includes: { answer: 'products_offered', value: 'outro' } },
          { not: { answerMissing: 'products_other_describe' } },
        ],
      },
    },
    92
  ),
]

const agro: ExperienceQuestion[] = [
  q({ code: 'agro_crops', segmentCode: 'agro', prompt: 'Quais culturas sua empresa produz?', options: opts('Soja', 'Milho', 'Algodão', 'Café', 'Cana-de-açúcar', 'Trigo', 'Arroz', 'Hortaliças', 'Outra'), mapsTo: 'fact.crops' }, 110),
  q({ code: 'agro_land_tenure', segmentCode: 'agro', prompt: 'A propriedade é própria ou arrendada?', options: opts('Própria', 'Arrendada'), mapsTo: 'fact.land_tenure' }, 120),
  q({ code: 'agro_production_unit', segmentCode: 'agro', prompt: 'Qual é a unidade utilizada para acompanhar sua produção?', options: opts('Hectare', 'Saca', 'Tonelada', 'Outra'), mapsTo: 'fact.production_unit' }, 130),
  q({ code: 'agro_inputs', segmentCode: 'agro', prompt: 'Quais são os principais insumos?', options: opts('Sementes', 'Fertilizantes', 'Defensivos', 'Combustível', 'Mão de obra', 'Outros'), mapsTo: 'fact.main_inputs' }, 170),
  q({ code: 'agro_own_machinery', segmentCode: 'agro', prompt: 'Existe maquinário próprio?', options: YES_NO, mapsTo: 'fact.own_machinery' }, 180),
  q({ code: 'agro_third_party', segmentCode: 'agro', prompt: 'Existe contratação de serviços de terceiros?', options: YES_NO, mapsTo: 'fact.third_party_services' }, 190),
  q({ code: 'agro_financing', segmentCode: 'agro', prompt: 'Existe financiamento agrícola?', options: YES_NO, mapsTo: 'fact.agricultural_financing' }, 200),
]

const livestock: ExperienceQuestion[] = [
  q({ code: 'pec_type', segmentCode: 'livestock', prompt: 'Qual é o tipo de pecuária?', options: opts('Bovinocultura', 'Avicultura', 'Suinocultura', 'Ovinocultura', 'Outra'), mapsTo: 'fact.livestock_type' }, 110),
  q({ code: 'pec_kind', segmentCode: 'livestock', prompt: 'A atividade é de corte, leite ou outra?', options: opts('Corte', 'Leite', 'Outro'), mapsTo: 'fact.livestock_kind' }, 120),
  q({ code: 'pec_system', segmentCode: 'livestock', prompt: 'Qual é o sistema de criação?', options: opts('Pasto', 'Confinamento', 'Semi-confinamento'), mapsTo: 'fact.breeding_system' }, 130),
]

const fishing: ExperienceQuestion[] = [
  q({ code: 'fish_type', segmentCode: 'fishing', prompt: 'Qual é o tipo de operação?', options: opts('Pesca', 'Piscicultura', 'Aquicultura'), mapsTo: 'fact.fishing_type' }, 110),
  q({ code: 'fish_species', segmentCode: 'fishing', prompt: 'Quais espécies são produzidas ou capturadas?', options: opts('Tilápia', 'Tambaqui', 'Camarão', 'Peixes nativos', 'Outra'), mapsTo: 'fact.species' }, 120),
  q({ code: 'fish_feed', segmentCode: 'fishing', prompt: 'A ração é um custo relevante?', options: YES_NO, mapsTo: 'fact.feed_is_relevant' }, 130),
]

const commerce: ExperienceQuestion[] = [
  q(
    {
      code: 'com_channel',
      segmentCode: 'commerce',
      prompt: 'Como a empresa vende?',
      helpText:
        'Pode marcar loja física, e-commerce e marketplace. Centros de custo, categorias e indicadores mudam conforme os canais.',
      options: SALES_CHANNEL_OPTIONS,
      mapsTo: 'fact.sales_channel',
    },
    110
  ),
]

const industry: ExperienceQuestion[] = [
  q({ code: 'ind_type', segmentCode: 'industry', prompt: 'Qual é o tipo de indústria?', options: opts('Alimentos', 'Metalúrgica', 'Química', 'Têxtil', 'Móveis', 'Outra'), mapsTo: 'fact.industry_type' }, 110),
]

const construction: ExperienceQuestion[] = [
  q({ code: 'con_type', segmentCode: 'construction', prompt: 'Qual é o tipo de obras?', options: opts('Residencial', 'Comercial', 'Infraestrutura', 'Reforma'), mapsTo: 'fact.work_type' }, 110),
]

const transport: ExperienceQuestion[] = [
  q({ code: 'trn_type', segmentCode: 'transport_logistics', prompt: 'Qual é o tipo de veículos?', options: opts('Caminhão', 'Van', 'Carreta', 'Utilitário'), mapsTo: 'fact.vehicle_type' }, 110),
]

const food: ExperienceQuestion[] = [
  q({ code: 'food_type', segmentCode: 'food', prompt: 'Qual é o tipo de estabelecimento?', options: opts('Restaurante', 'Lanchonete', 'Padaria', 'Dark kitchen', 'Buffet', 'Outro'), mapsTo: 'fact.food_type' }, 110),
  q({ code: 'food_delivery', segmentCode: 'food', prompt: 'A empresa trabalha com delivery?', options: YES_NO, mapsTo: 'fact.has_delivery' }, 130),
]

const services: ExperienceQuestion[] = []

const tech: ExperienceQuestion[] = [
  q({ code: 'tech_type', segmentCode: 'tech', prompt: 'Qual é o tipo da empresa?', options: opts('SaaS', 'Software sob demanda', 'Consultoria de TI', 'Produto digital'), mapsTo: 'fact.tech_type' }, 110),
  q({ code: 'tech_offer', segmentCode: 'tech', prompt: 'A empresa vende produtos ou serviços?', options: opts('Produtos', 'Serviços'), mapsTo: 'fact.offer_type' }, 120),
  q({ code: 'tech_model', segmentCode: 'tech', prompt: 'O modelo é SaaS ou projetos?', options: opts('SaaS', 'Projetos', 'Híbrido'), mapsTo: 'fact.delivery_model' }, 130),
  q({ code: 'tech_recurring', segmentCode: 'tech', prompt: 'A empresa possui receita recorrente?', options: YES_NO, mapsTo: 'fact.has_recurring_revenue' }, 140),
]

const health: ExperienceQuestion[] = [
  q({ code: 'hlt_type', segmentCode: 'health', prompt: 'Qual é o tipo de estabelecimento?', options: opts('Clínica', 'Consultório', 'Hospital', 'Laboratório', 'Outro'), mapsTo: 'fact.health_type' }, 110),
]

const education: ExperienceQuestion[] = [
  q({ code: 'edu_type', segmentCode: 'education', prompt: 'Qual é o tipo de instituição?', options: opts('Escola', 'Curso livre', 'Faculdade', 'Treinamento corporativo', 'Outro'), mapsTo: 'fact.education_type' }, 110),
]

const realEstate: ExperienceQuestion[] = [
  q({ code: 're_model', segmentCode: 'real_estate', prompt: 'A operação é de compra e venda ou aluguel?', options: opts('Compra e venda', 'Aluguel', 'Administração predial'), mapsTo: 'fact.real_estate_model' }, 110),
]

const automotive: ExperienceQuestion[] = [
  q({ code: 'auto_type', segmentCode: 'automotive', prompt: 'Qual é o tipo de operação?', options: opts('Oficina', 'Concessionária', 'Peças', 'Estética automotiva'), mapsTo: 'fact.auto_type' }, 110),
  q({ code: 'auto_services', segmentCode: 'automotive', prompt: 'Quais serviços são realizados?', options: opts('Manutenção', 'Funilaria', 'Estética', 'Venda de peças', 'Venda de veículos'), mapsTo: 'fact.auto_services' }, 120),
]

const energy: ExperienceQuestion[] = [
  q({ code: 'eng_type', segmentCode: 'energy', prompt: 'Qual é o tipo de geração ou operação?', options: opts('Solar', 'Eólica', 'Hidrelétrica', 'Distribuição', 'Eficiência energética', 'Outra'), mapsTo: 'fact.energy_type' }, 110),
]

const mining: ExperienceQuestion[] = [
  q({ code: 'min_type', segmentCode: 'mining', prompt: 'Qual é o tipo de mineral?', answerType: 'text', mapsTo: 'fact.mineral_type' }, 110),
  q({ code: 'min_sites', segmentCode: 'mining', prompt: 'Quais localidades são exploradas?', answerType: 'text', optional: true, mapsTo: 'fact.sites' }, 120),
]

const hospitality: ExperienceQuestion[] = [
  q({ code: 'hot_services', segmentCode: 'hospitality', prompt: 'Quais serviços adicionais existem?', options: opts('Restaurante', 'Eventos', 'Spa', 'Transfers', 'Nenhum'), mapsTo: 'fact.extra_services' }, 110),
  q({ code: 'hot_platforms', segmentCode: 'hospitality', prompt: 'Há comissões de plataformas de reserva?', options: YES_NO, mapsTo: 'fact.platform_commissions' }, 120),
]

const beauty: ExperienceQuestion[] = [
  q({ code: 'beau_services', segmentCode: 'beauty', prompt: 'Quais serviços são oferecidos?', options: opts('Cabelo', 'Estética', 'Unhas', 'Barbearia', 'Outros'), mapsTo: 'fact.beauty_services' }, 110),
]

const media: ExperienceQuestion[] = [
  q(
    {
      code: 'media_type',
      segmentCode: 'media',
      prompt: 'Qual é o tipo de operação de mídia?',
      options: opts(
        'Conteúdo',
        'Publicidade',
        'Jornalismo',
        'Produção audiovisual',
        'Outro'
      ),
      mapsTo: 'fact.media_type',
    },
    110
  ),
]

const marketing: ExperienceQuestion[] = [
  q({ code: 'mkt_recurring', segmentCode: 'marketing', prompt: 'Há contratos recorrentes?', options: YES_NO, mapsTo: 'fact.has_recurring_contracts' }, 110),
]

const entertainment: ExperienceQuestion[] = [
  q({ code: 'ent_type', segmentCode: 'entertainment', prompt: 'Qual é o tipo de negócio?', options: opts('Casa de shows', 'Teatro', 'Produtora', 'Espaço cultural', 'Outro'), mapsTo: 'fact.entertainment_type' }, 110),
]

const sports: ExperienceQuestion[] = [
  q({ code: 'spt_type', segmentCode: 'sports', prompt: 'Qual é o tipo de negócio?', options: opts('Academia', 'Clube', 'Escola esportiva', 'Arena', 'Outro'), mapsTo: 'fact.sports_type' }, 110),
  q({ code: 'spt_events', segmentCode: 'sports', prompt: 'A empresa realiza eventos?', options: YES_NO, mapsTo: 'fact.has_events' }, 120),
]

const environment: ExperienceQuestion[] = [
  q({ code: 'env_type', segmentCode: 'environment', prompt: 'Qual é o tipo de serviço ambiental?', options: opts('Gestão de resíduos', 'Consultoria', 'Licenciamento', 'Reciclagem', 'Outro'), mapsTo: 'fact.environment_type' }, 110),
]

const financial: ExperienceQuestion[] = [
  q({ code: 'fin_type', segmentCode: 'financial', prompt: 'Qual é o tipo de serviço financeiro?', options: opts('Correspondente', 'Seguros', 'Crédito', 'Consultoria', 'Outro'), mapsTo: 'fact.financial_type' }, 110),
]

const professional: ExperienceQuestion[] = [
  q({ code: 'pro_type', segmentCode: 'professional', prompt: 'Qual é o tipo de serviço profissional?', options: opts('Consultoria', 'Advocacia', 'Contabilidade', 'Engenharia', 'Outro'), mapsTo: 'fact.professional_type' }, 110),
]

const publicAdmin: ExperienceQuestion[] = [
  q({ code: 'pub_type', segmentCode: 'public_admin', prompt: 'Qual é o tipo de órgão ou entidade?', answerType: 'text', mapsTo: 'fact.public_type' }, 110),
  q({ code: 'pub_budget', segmentCode: 'public_admin', prompt: 'O acompanhamento principal é orçamentário?', options: YES_NO, mapsTo: 'fact.budget_focus' }, 120),
]

const other: ExperienceQuestion[] = [
  q({ code: 'oth_activity', segmentCode: 'other', prompt: 'Como você descreveria a operação principal?', answerType: 'text', mapsTo: 'fact.other_activity' }, 110),
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
