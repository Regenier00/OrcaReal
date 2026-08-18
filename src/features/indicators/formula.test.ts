import {
  actualCostForMonth,
  actualRevenueForMonth,
  buildActualTotals,
  consolidatedQuantity,
  defaultCustomFormula,
  evaluateFormula,
  formulaHint,
  formulaUsesQuantity,
  quantityVolumeKey,
  secondOperandIsPeriod,
  suggestedDisplayUnit,
} from './formula.ts'
import type { BudgetMonth } from '../budget/period.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function month(key: string): BudgetMonth {
  const [year, monthNumber] = key.split('-').map(Number)
  return {
    year,
    month: monthNumber,
    key,
    label: key,
    fullLabel: key,
  }
}

const actual = {
  items: [
    { categoryType: 'revenue', amounts: { '2026-07': 1000, '2026-08': 1200 } },
    { categoryType: 'cost', amounts: { '2026-07': 400, '2026-08': 500 } },
    { categoryType: 'expense', amounts: { '2026-07': 100, '2026-08': 80 } },
  ],
}

const classified = [
  { monthKey: '2026-08', amount: 50, type: 'expense' },
  { monthKey: '2026-08', amount: 200, type: 'income' },
]

assert(actualRevenueForMonth(actual, classified, '2026-08') === 1400, 'receitas não misturam custo')
assert(actualCostForMonth(actual, classified, '2026-08') === 630, 'custos não misturam receita')
assert(actualRevenueForMonth(actual, classified, '2026-07') === 1000, 'receita do mês anterior')
assert(actualCostForMonth(actual, classified, '2026-07') === 500, 'custo do mês anterior')

const totals = buildActualTotals([month('2026-07'), month('2026-08')], actual, classified)
assert(totals.consolidated.revenue === 2400, 'receita consolidada soma os meses')
assert(totals.consolidated.cost === 1130, 'custo consolidado soma os meses')
assert(totals.byMonth['2026-08'].revenue === 1400, 'receita do período')
assert(totals.byMonth['2026-08'].cost === 630, 'custo do período')

const formula = defaultCustomFormula()
assert(formulaUsesQuantity(formula), 'fórmula padrão usa quantidade')
assert(
  formulaHint(formula) === 'Custos realizados (período) ÷ Quantidade da unidade (período)',
  `hint da fórmula padrão: ${formulaHint(formula)}`
)
assert(suggestedDisplayUnit(formula, 'Caminhão') === 'R$/caminhão', 'unidade sugerida')

const costPerUnit = evaluateFormula(formula, {
  period: totals.byMonth['2026-08'],
  consolidated: totals.consolidated,
  periodQuantity: 10,
  consolidatedQuantity: 25,
})
assert(costPerUnit === 63, `custo por unidade do período: ${costPerUnit}`)

const revenuePerUnit = evaluateFormula(
  {
    left: { metric: 'actual_revenue', scope: 'period' },
    op: 'div',
    right: { metric: 'quantity', scope: 'period' },
  },
  {
    period: totals.byMonth['2026-08'],
    consolidated: totals.consolidated,
    periodQuantity: 10,
    consolidatedQuantity: 25,
  }
)
assert(revenuePerUnit === 140, `receita por unidade: ${revenuePerUnit}`)

const consolidatedCost = evaluateFormula(
  {
    left: { metric: 'actual_cost', scope: 'consolidated' },
    op: 'div',
    right: { metric: 'quantity', scope: 'consolidated' },
  },
  {
    period: totals.byMonth['2026-08'],
    consolidated: totals.consolidated,
    periodQuantity: 10,
    consolidatedQuantity: 25,
  }
)
assert(consolidatedCost === 45.2, `custo consolidado por unidade: ${consolidatedCost}`)

assert(
  evaluateFormula(formula, {
    period: totals.byMonth['2026-08'],
    consolidated: totals.consolidated,
    periodQuantity: null,
    consolidatedQuantity: 25,
  }) == null,
  'sem quantidade do período não calcula'
)

assert(
  evaluateFormula(formula, {
    period: totals.byMonth['2026-08'],
    consolidated: totals.consolidated,
    periodQuantity: 0,
    consolidatedQuantity: 25,
  }) == null,
  'quantidade zero não divide'
)

assert(consolidatedQuantity({ '2026-07': 10, '2026-08': 15 }) === 25, 'quantidade consolidada')
assert(consolidatedQuantity({}) == null, 'sem quantidade consolidada')
assert(
  consolidatedQuantity({ all: 40, '2026-07': 10, '2026-08': 15 }) === 40,
  'quantidade consolidada fixa prevalece sobre a soma mensal'
)
assert(secondOperandIsPeriod(formula), 'fórmula padrão permite trocar o período')
assert(
  !secondOperandIsPeriod({
    left: { metric: 'actual_cost', scope: 'consolidated' },
    op: 'div',
    right: { metric: 'quantity', scope: 'consolidated' },
  }),
  'segundo operador consolidado trava o período'
)
assert(quantityVolumeKey(formula, '2026-08') === '2026-08', 'quantidade por mês')
assert(
  quantityVolumeKey(
    {
      left: { metric: 'actual_cost', scope: 'consolidated' },
      op: 'div',
      right: { metric: 'quantity', scope: 'consolidated' },
    },
    '2026-08'
  ) === 'all',
  'quantidade consolidada usa chave única'
)

console.log('custom indicator formula tests ok')
