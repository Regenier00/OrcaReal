import { SEGMENT_OPTIONS } from '../company/segmentOptions.ts'
import {
  defaultUnitCodesForSegments,
  unitCostsForSegments,
} from './catalog/segmentUnits.ts'
import {
  COST_PER_EMPLOYEE,
  REVENUE_PER_EMPLOYEE,
  isEmployeeHeadcountIndicator,
  parseEmployeeCount,
  volumesFromEmployeeCount,
} from './employeeCount.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function unitCostForMonth(totalCost: number, quantity: number | null | undefined) {
  if (quantity == null || !Number.isFinite(quantity) || quantity <= 0) return null
  if (!Number.isFinite(totalCost)) return null
  return roundMoney(totalCost / quantity)
}

function realizedCostForMonth(
  actual: { items: Array<{ categoryType: string | null; amounts: Record<string, number> }> } | null,
  classified: Array<{ monthKey: string; amount: number; type: string }>,
  month: string
) {
  const fromItems = roundMoney(
    (actual?.items ?? [])
      .filter((item) => item.categoryType !== 'revenue')
      .reduce((total, item) => total + (item.amounts[month] ?? 0), 0)
  )
  const fromClassified = roundMoney(
    classified
      .filter((slice) => slice.monthKey === month && slice.type === 'expense')
      .reduce((total, slice) => total + slice.amount, 0)
  )
  return roundMoney(fromItems + fromClassified)
}

function testSegmentCoverage() {
  for (const option of SEGMENT_OPTIONS) {
    const defs = unitCostsForSegments([option.code])
    assert(defs.length > 0, `ramo ${option.code} precisa de unidade de custo`)
  }

  const tech = unitCostsForSegments(['tech'])
  assert(tech.length === 2, 'tecnologia deve ter custo por projeto e por hora')
  assert(
    tech.some((item) => item.displayUnit === 'R$/projeto'),
    'tecnologia deve expor R$/projeto'
  )
  assert(
    tech.some((item) => item.displayUnit === 'R$/hora'),
    'tecnologia deve expor R$/hora'
  )

  const pec = unitCostsForSegments(['livestock'])[0]
  assert(pec.displayUnit === 'R$/cabeça', 'pecuária usa R$/cabeça')
  assert(
    pec.quantityPrompt.toLowerCase().includes('cabeças'),
    'pecuária pergunta a quantidade de cabeças'
  )

  const trn = unitCostsForSegments(['transport_logistics'])[0]
  assert(trn.displayUnit === 'R$/km rodado', 'transporte usa R$/km rodado')
  assert(
    trn.quantityPrompt.toLowerCase().includes('quilômetros') ||
      trn.quantityPrompt.toLowerCase().includes('km'),
    'transporte pergunta os km rodados'
  )

  const extra = unitCostsForSegments(['livestock', 'transport_logistics'])
  assert(extra.length === 2, 'ramos extras geram um card para cada unidade')
  assert(
    defaultUnitCodesForSegments(['agro']).includes('hectare'),
    'agro usa hectare como unidade padrão'
  )
}

function testCalculation() {
  assert(unitCostForMonth(45000, 200) === 225, 'custo por cabeça = 45000 / 200')
  assert(unitCostForMonth(1000, 0) == null, 'quantidade zero não calcula')
  assert(unitCostForMonth(1000, null) == null, 'sem quantidade não calcula')
  assert(unitCostForMonth(10, 3) === 3.33, 'arredonda o resultado')

  const actual = {
    items: [
      { categoryType: 'cost', amounts: { '2026-08': 80 } },
      { categoryType: 'expense', amounts: { '2026-08': 20 } },
      { categoryType: 'revenue', amounts: { '2026-08': 999 } },
    ],
  }

  const classified = [
    { monthKey: '2026-08', amount: 50, type: 'expense' },
    { monthKey: '2026-08', amount: 30, type: 'income' },
  ]

  const total = realizedCostForMonth(actual, classified, '2026-08')
  assert(total === 150, `custo realizado ignora receita e soma custos: ${total}`)
}

function testEmployeeCount() {
  assert(parseEmployeeCount(12) === 12, 'número inteiro de funcionários')
  assert(parseEmployeeCount('25') === 25, 'número em texto')
  assert(parseEmployeeCount('11_50') == null, 'faixa antiga não vira quantidade')
  assert(parseEmployeeCount(0) == null, 'zero não conta')
  assert(isEmployeeHeadcountIndicator(COST_PER_EMPLOYEE), 'custo por funcionário')
  assert(isEmployeeHeadcountIndicator(REVENUE_PER_EMPLOYEE), 'receita por funcionário')

  const volumes = volumesFromEmployeeCount(8, ['2026-07', '2026-08'])
  assert(volumes['2026-07'] === 8, 'preenche julho com o quadro da empresa')
  assert(volumes['2026-08'] === 8, 'preenche agosto com o quadro da empresa')
  assert(unitCostForMonth(1600, volumes['2026-08']) === 200, 'custo por funcionário = 1600 / 8')
}

testSegmentCoverage()
testCalculation()
testEmployeeCount()
console.log('unitCost tests ok')
