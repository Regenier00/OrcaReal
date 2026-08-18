import {
  buildFinancialInsights,
  buildFinancialSeries,
  changeRatio,
  monthFinancials,
  previousMonth,
  sumClassifiedForMonth,
  sumItemsForMonth,
} from './dashboardModel.ts'
import type { BudgetMonth } from '../budget/period.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function month(key: string, label: string, shortLabel: string): BudgetMonth {
  const [year, monthNumber] = key.split('-').map(Number)
  return {
    year,
    month: monthNumber,
    key,
    label: shortLabel,
    fullLabel: label,
  }
}

const jul = month('2026-07', 'Julho/2026', 'Jul')
const aug = month('2026-08', 'Agosto/2026', 'Ago')

const actual = {
  items: [
    { categoryType: 'revenue' as const, amounts: { '2026-07': 1000, '2026-08': 1200 } },
    { categoryType: 'cost' as const, amounts: { '2026-07': 400, '2026-08': 500 } },
    { categoryType: 'expense' as const, amounts: { '2026-07': 100, '2026-08': 80 } },
  ],
}

const budget = {
  items: [
    { categoryType: 'cost' as const, amounts: { '2026-07': 450, '2026-08': 450 } },
    { categoryType: 'expense' as const, amounts: { '2026-07': 100, '2026-08': 100 } },
  ],
}

const classified = [
  { monthKey: '2026-08', amount: 50, type: 'expense' },
  { monthKey: '2026-08', amount: 200, type: 'income' },
]

assert(sumItemsForMonth(actual.items, '2026-08', ['revenue']) === 1200, 'soma receita')
assert(sumItemsForMonth(actual.items, '2026-08', 'non-revenue') === 580, 'soma não receita')
assert(sumClassifiedForMonth(classified, '2026-08', ['income']) === 200, 'soma entrada classificada')
assert(changeRatio(120, 100) === 0.2, 'variação percentual')
assert(changeRatio(0, 0) === 0, 'variação zero sobre zero')
assert(changeRatio(10, 0) === null, 'variação indefinida quando base é zero')
assert(previousMonth([jul, aug], '2026-08')?.key === '2026-07', 'mês anterior')
assert(previousMonth([jul, aug], '2026-07') === null, 'primeiro mês não tem anterior')

const snapshot = monthFinancials(aug, actual, classified, budget)
assert(snapshot.revenue === 1400, 'receita inclui lançamentos classificados')
assert(snapshot.realized === 630, 'realizado soma custos, despesas e saídas classificadas')
assert(snapshot.profit === 770, 'resultado = receita - realizado')
assert(snapshot.budgeted === 550, 'orçado ignora receita')
assert(snapshot.variance === 80, 'desvio = realizado - orçado')

const series = buildFinancialSeries([jul, aug], actual, classified, budget, '2026-08')
assert(series.length === 2, 'série mensal até o mês corrente')
assert(series[1].key === '2026-08', 'último ponto é o mês corrente')

const insights = buildFinancialInsights({
  current: snapshot,
  previous: monthFinancials(jul, actual, [], budget),
  hasBudget: true,
  hasRealized: true,
  unitCostMissing: true,
})

assert(
  insights.some((item) => item.id === 'profit'),
  'insight de resultado positivo'
)
assert(
  insights.some((item) => item.id === 'costs-up'),
  'insight de custos em alta'
)
assert(
  insights.some((item) => item.id === 'over-budget'),
  'insight de desvio acima do orçado'
)
assert(
  insights.some((item) => item.id === 'unit-cost'),
  'insight de custo unitário incompleto'
)
assert(insights.length <= 4, 'limita a quantidade de insights')

const emptyInsights = buildFinancialInsights({
  current: null,
  previous: null,
  hasBudget: false,
  hasRealized: false,
  unitCostMissing: false,
})
assert(
  emptyInsights.some((item) => item.id === 'no-actual'),
  'sem realizado sugere importar'
)
assert(
  emptyInsights.some((item) => item.id === 'no-budget'),
  'sem orçamento sugere criar plano'
)

console.log('dashboard model tests ok')
