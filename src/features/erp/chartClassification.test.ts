import {
  destinationFromCostCenter,
  matchChartAccount,
  type ChartAccountLike,
} from './chartClassification.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const sample: ChartAccountLike[] = [
  {
    account_code: '3.1',
    match_kind: 'prefix',
    money_group: 'revenue',
    priority: 40,
  },
  {
    account_code: '4.1',
    match_kind: 'prefix',
    money_group: 'cost',
    priority: 10,
  },
  {
    account_code: '4',
    match_kind: 'prefix',
    money_group: 'expense',
    priority: 90,
  },
  {
    account_code: '1.2',
    match_kind: 'prefix',
    money_group: 'investment',
    priority: 40,
  },
]

function testPrefixMapsToGroup() {
  const hit = matchChartAccount('3.1.05', sample)
  assert(hit, 'deveria casar 3.1')
  assert(hit.moneyGroup === 'revenue', 'receita')
  assert(hit.matchKind === 'prefix', 'prefix')
  assert(hit.matchedCode === '3.1', 'código 3.1')
}

function testLongestPrefixWins() {
  const hit = matchChartAccount('4.1.99', sample)
  assert(hit?.moneyGroup === 'cost', '4.1 vence 4')
  assert(hit?.matchedCode === '4.1', 'prefixo 4.1')
}

function testDestinationFromCostCenter() {
  assert(
    destinationFromCostCenter({
      costCenterName: 'Comercial',
      costCenterCode: 'CC-01',
    }) === 'Comercial',
    'nome do CC',
  )
  assert(
    destinationFromCostCenter({
      costCenterName: '',
      costCenterCode: 'CC-01',
    }) === 'CC-01',
    'código do CC',
  )
  assert(
    destinationFromCostCenter({
      costCenterName: null,
      costCenterCode: null,
      accountName: 'Vendas',
    }) === 'Vendas',
    'fallback conta',
  )
  assert(
    destinationFromCostCenter({}) === 'Sem centro de custo',
    'fallback padrão',
  )
}

function testUnmapped() {
  assert(matchChartAccount('9.9', sample) == null, 'sem mapeamento')
}

testPrefixMapsToGroup()
testLongestPrefixWins()
testDestinationFromCostCenter()
testUnmapped()

console.log('chartClassification tests passed')
