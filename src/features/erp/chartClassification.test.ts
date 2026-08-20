import {
  matchChartAccount,
  suggestGroupFromDescription,
  type ChartAccountLike,
} from './chartClassification.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const sample: ChartAccountLike[] = [
  {
    account_code: '3.1.01',
    match_kind: 'exact',
    money_group: 'revenue',
    destination_name: 'Vendas',
  },
  {
    account_code: '4.1',
    match_kind: 'prefix',
    money_group: 'cost',
    destination_name: 'Custos operacionais',
    priority: 10,
  },
  {
    account_code: '4',
    match_kind: 'prefix',
    money_group: 'expense',
    destination_name: 'Despesas operacionais',
    priority: 90,
  },
  {
    account_code: '1.2',
    match_kind: 'prefix',
    money_group: 'investment',
    destination_name: 'Investimentos',
    priority: 40,
  },
]

function testExactAutoAppropriation() {
  const hit = matchChartAccount('3.1.01', sample)
  assert(hit, 'deveria achar conta exata')
  assert(hit.source === 'chart', 'fonte chart')
  assert(hit.matchKind === 'exact', 'kind exact')
  assert(hit.moneyGroup === 'revenue', 'grupo receita')
  assert(hit.destinationName === 'Vendas', 'destino')
}

function testLongestPrefixWins() {
  const hit = matchChartAccount('4.1.05', sample)
  assert(hit, 'deveria achar prefixo')
  assert(hit.source === 'prefix', 'fonte prefix')
  assert(hit.moneyGroup === 'cost', '4.1 vence 4')
  assert(hit.matchedCode === '4.1', 'prefixo 4.1')
}

function testGenericPrefixFallback() {
  const hit = matchChartAccount('4.9.99', sample)
  assert(hit, 'prefixo 4')
  assert(hit.moneyGroup === 'expense', 'cai em despesa')
  assert(hit.matchedCode === '4', 'código 4')
}

function testUnmappedReturnsNull() {
  const hit = matchChartAccount('9.9.9', sample)
  assert(hit == null, 'sem mapeamento')
}

function testDescriptionSuggestion() {
  const revenue = suggestGroupFromDescription('Recebimento de vendas loja')
  assert(revenue?.moneyGroup === 'revenue', 'receita por descrição')

  const cost = suggestGroupFromDescription('CMV produtos acabados')
  assert(cost?.moneyGroup === 'cost', 'custo por descrição')

  const expense = suggestGroupFromDescription('Conta de energia elétrica')
  assert(expense?.moneyGroup === 'expense', 'despesa por descrição')

  const investment = suggestGroupFromDescription(
    'Compra de equipamento imobilizado',
  )
  assert(investment?.moneyGroup === 'investment', 'investimento por descrição')
}

function testInactiveIgnored() {
  const hit = matchChartAccount('3.1.01', [
    {
      account_code: '3.1.01',
      match_kind: 'exact',
      money_group: 'revenue',
      destination_name: 'Vendas',
      is_active: false,
    },
  ])
  assert(hit == null, 'conta inativa não deve casar')
}

testExactAutoAppropriation()
testLongestPrefixWins()
testGenericPrefixFallback()
testUnmappedReturnsNull()
testDescriptionSuggestion()
testInactiveIgnored()

console.log('chartClassification tests passed')
