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

const agro = suggestBudgetDestinations({
  segmentCode: 'agro',
  revenueModel: 'producao_e_comercializacao',
  operationModel: 'operacao_arrendada',
  employeeCount: 12,
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
assert(agro.cost.includes('Sementes'), 'custo de insumos do cadastro')
assert(agro.cost.includes('Arrendamento'), 'custo de terra arrendada')
assert(agro.cost.includes('Serviços de terceiros'), 'custo de terceiros')
assert(agro.cost.includes('Maquinário e manutenção'), 'custo de maquinário próprio')
assert(agro.expense.includes('Aluguel'), 'despesas base')
assert(agro.expense.includes('Marketing'), 'despesas base marketing')
assert(agro.investment.includes('Máquinas e equipamentos'), 'investimentos base')
assert(agro.investment.includes('Maquinário agrícola'), 'investimento agro')

const tech = suggestBudgetDestinations({
  segmentCode: 'tech',
  revenueModel: 'receita_recorrente,prestacao_de_servicos',
  operationModel: 'operacao_propria',
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
assert(tech.cost.includes('Infraestrutura de TI'), 'custo tech')

const food = suggestBudgetDestinations({
  segmentCode: 'food',
  revenueModel: 'venda_de_produtos',
  profileFacts: { has_delivery: 'yes', food_type: 'restaurante' },
})
assert(food.revenue.includes('Delivery'), 'food delivery na receita')
assert(food.cost.includes('Custos de delivery'), 'food delivery no custo')

const commerce = suggestBudgetDestinations({
  segmentCode: 'commerce',
  revenueModel: 'venda_de_produtos',
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

console.log('budget default destinations tests ok')
