import { buildUnitCostCard } from './unitCostCard.ts'
import {
  CONSOLIDATED_VOLUME_KEY,
  defaultCustomFormula,
} from '../indicators/formula.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertEqual(actual: unknown, expected: unknown, message: string) {
  assert(Object.is(actual, expected), `${message} (got ${String(actual)}, expected ${String(expected)})`)
}

const def = {
  indicatorCode: 'cost_per_unit',
  indicatorName: 'Custo por unidade',
  displayUnit: 'R$/unidade',
  quantityPrompt: 'Quantas unidades?',
  quantityHelp: 'Informe a quantidade.',
  quantityNoun: 'unidades',
  quantityNounSingular: 'unidade',
}

const totals = {
  byMonth: {
    '2026-07': { revenue: 1000, cost: 400 },
    '2026-08': { revenue: 1400, cost: 730 },
  },
  consolidated: { revenue: 2400, cost: 1130 },
}

const volumes = {
  '2026-07': 10,
  '2026-08': 15,
}

const monthly = buildUnitCostCard({
  def,
  kind: 'catalog',
  segmentLabel: 'Teste',
  formula: defaultCustomFormula(),
  volumes,
  monthKey: '2026-08',
  monthLabel: 'Agosto 2026',
  previousKey: '2026-07',
  totals,
  isConsolidated: false,
})

assertEqual(monthly.canChangePeriod, true, 'mensal permite trocar o mês')
assertEqual(monthly.isConsolidated, false, 'mensal não é consolidado')
assertEqual(monthly.unitCost, 48.67, 'custo do mês')
assertEqual(monthly.quantity, 15, 'quantidade do mês')
assertEqual(monthly.monthLabel, 'Agosto 2026', 'rótulo do mês')

const consolidated = buildUnitCostCard({
  def,
  kind: 'catalog',
  segmentLabel: 'Teste',
  formula: defaultCustomFormula(),
  volumes,
  monthKey: CONSOLIDATED_VOLUME_KEY,
  monthLabel: 'Período completo',
  previousKey: null,
  totals,
  isConsolidated: true,
})

assertEqual(consolidated.canChangePeriod, false, 'consolidado trava o mês')
assertEqual(consolidated.isConsolidated, true, 'flag consolidado')
assertEqual(consolidated.quantityIsConsolidated, true, 'quantidade consolidada')
assertEqual(consolidated.monthKey, CONSOLIDATED_VOLUME_KEY, 'chave all')
assertEqual(consolidated.monthLabel, 'Período completo', 'rótulo consolidado')
assertEqual(consolidated.quantity, 25, 'soma das quantidades mensais')
assertEqual(consolidated.unitCost, 45.2, 'custo consolidado')
assertEqual(consolidated.previousUnitCost, null, 'sem comparação no consolidado')

console.log('unitCostCard.test.ts: ok')
