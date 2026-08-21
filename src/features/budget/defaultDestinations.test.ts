import {
  normalizeDestinationName,
  suggestBudgetDestinations,
} from './defaultDestinations.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

assert(
  normalizeDestinationName('  insumos  ') === 'INSUMOS',
  'destino normaliza para maiúsculas'
)

const costCenters = ['Operações e Produção', 'Marketing', 'Logística']

const agro = suggestBudgetDestinations({
  segmentCode: 'agro',
  revenueModel: 'producao_e_comercializacao',
  operationModel: 'operacao_arrendada',
  employeeCount: 12,
  costCenterNames: costCenters,
  profileFacts: {
    crops: ['soja', 'milho'],
    main_inputs: ['sementes', 'fertilizantes', 'defensivos'],
    land_tenure: 'arrendada',
    own_machinery: 'yes',
    third_party_services: 'yes',
  },
})

assert(agro.revenue.some((item) => item.includes('Soja')), 'receita personalizada soja')
assert(agro.revenue.some((item) => item.includes('Milho')), 'receita personalizada milho')
assert(
  agro.cost.every((item) => costCenters.includes(item)) && agro.cost.length === 3,
  'custos usam só centros de custo do usuário'
)
assert(
  agro.expense.every((item) => costCenters.includes(item)) && agro.expense.length === 3,
  'despesas usam só centros de custo do usuário'
)
assert(!agro.cost.includes('Sementes'), 'sistema não inventa destino de custo')
assert(!agro.expense.includes('Aluguel'), 'sistema não inventa destino de despesa')
assert(agro.investment.includes('Máquinas e equipamentos'), 'investimentos base')
assert(agro.investment.includes('Maquinário agrícola'), 'investimento agro')

const withoutCenters = suggestBudgetDestinations({
  segmentCode: 'tech',
  revenueModel: 'receita_recorrente',
  costCenterNames: [],
})
assert(withoutCenters.cost.length === 0, 'sem centros de custo → sem destinos de custo')
assert(withoutCenters.expense.length === 0, 'sem centros de custo → sem destinos de despesa')

const tech = suggestBudgetDestinations({
  segmentCode: 'tech',
  revenueModel: 'receita_recorrente,prestacao_de_servicos',
  operationModel: 'operacao_propria',
  costCenterNames: ['Infraestrutura'],
  profileFacts: {
    delivery_model: 'saas',
    has_recurring_revenue: 'yes',
    offer_type: 'servicos',
  },
})

assert(
  tech.revenue.some((item) => /recorrente/i.test(item)),
  'tech com receita recorrente'
)
assert(
  tech.revenue.some((item) => /serviço/i.test(item)),
  'tech com serviços'
)
assert(tech.cost.includes('Infraestrutura'), 'custo = centro de custo')

const food = suggestBudgetDestinations({
  segmentCode: 'food',
  revenueModel: 'venda_de_produtos',
  costCenterNames: ['Cozinha'],
  profileFacts: { has_delivery: 'yes', food_type: 'restaurante' },
})
assert(food.revenue.includes('Delivery'), 'food delivery na receita')
assert(food.cost.includes('Cozinha'), 'food custo = centro de custo')
assert(!food.cost.includes('Custos de delivery'), 'não inventa custo de delivery')

const commerce = suggestBudgetDestinations({
  segmentCode: 'commerce',
  revenueModel: 'venda_de_produtos',
  costCenterNames: ['Estoque'],
  profileFacts: {
    products_sold: 'café especial, chocolate artesanal',
    sales_channel: ['fisica', 'marketplace'],
  },
})
assert(
  commerce.revenue.some((item) => /café especial/i.test(item)),
  'comércio usa produtos informados no cadastro'
)
assert(
  commerce.revenue.some((item) => /chocolate artesanal/i.test(item)),
  'comércio gera um destino por produto'
)

const commerceSmart = suggestBudgetDestinations({
  segmentCode: 'commerce',
  extraSegmentCodes: ['food'],
  revenueModel: 'venda_de_produtos',
  costCenterNames: ['Vendas'],
  profileFacts: {
    products_offered: ['commerce:vestuario', 'food:marmitas'],
    products_other_describe: 'outro item ignorado se houver match',
  },
})
assert(
  commerceSmart.revenue.some((item) => /vestuário/i.test(item)),
  'busca inteligente alimenta receita de comércio'
)
assert(
  commerceSmart.revenue.some((item) => /marmitas/i.test(item)),
  'outras operações alimentam receita com produtos do segundo ramo'
)

console.log('budget default destinations tests ok')
