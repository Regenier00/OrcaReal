import {
  buildFinancialSeries,
  changeRatio,
  monthFinancials,
  periodFinancials,
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
  { monthKey: '2026-08', amount: 30, type: 'expense', moneyGroup: 'cost' },
]

assert(sumItemsForMonth(actual.items, '2026-08', 'revenue') === 1200, 'soma receita')
assert(sumItemsForMonth(actual.items, '2026-08', 'operating') === 580, 'soma custo + despesa')
assert(sumClassifiedForMonth(classified, '2026-08', 'revenue') === 200, 'soma entrada classificada')
assert(sumClassifiedForMonth(classified, '2026-08', 'cost') === 30, 'saída classificada no grupo custo')
assert(sumClassifiedForMonth(classified, '2026-08', 'expense') === 50, 'saída sem grupo cai em despesa')
assert(changeRatio(120, 100) === 0.2, 'variação percentual')
assert(changeRatio(0, 0) === 0, 'variação zero sobre zero')
assert(changeRatio(10, 0) === null, 'variação indefinida quando base é zero')
assert(previousMonth([jul, aug], '2026-08')?.key === '2026-07', 'mês anterior')
assert(previousMonth([jul, aug], '2026-07') === null, 'primeiro mês não tem anterior')

const snapshot = monthFinancials(aug, actual, classified, budget)
assert(snapshot.revenue === 1400, 'receita inclui lançamentos classificados')
assert(snapshot.costs === 530, 'custo usa grupo custo + classificados do grupo')
assert(snapshot.expenses === 130, 'despesa usa grupo despesa + fallback de saída')
assert(snapshot.realized === 660, 'realizado = custo + despesa')
assert(snapshot.profit === 740, 'lucro = receita − custo − despesa')
assert(snapshot.budgeted === 550, 'orçado ignora receita e investimento')
assert(snapshot.variance === 110, 'desvio = realizado − orçado')

const sep = month('2026-09', 'Setembro/2026', 'Set')
const oct = month('2026-10', 'Outubro/2026', 'Out')

const budgetWithFuture = {
  items: [
    { categoryType: 'cost' as const, amounts: { '2026-07': 450, '2026-08': 450, '2026-09': 500 } },
    { categoryType: 'expense' as const, amounts: { '2026-07': 100, '2026-08': 100, '2026-09': 80 } },
  ],
}

const series = buildFinancialSeries(
  [jul, aug, sep, oct],
  actual,
  classified,
  budgetWithFuture
)
assert(series.length === 3, 'mostra meses com orçado ou realizado')
assert(series.some((item) => item.key === '2026-09'), 'inclui mês orçado sem realizado')
assert(series.find((item) => item.key === '2026-09')?.realized === 0, 'mês futuro pode ter realizado zero')
assert(!series.some((item) => item.key === '2026-10'), 'omite mês sem orçado e sem realizado')

const consolidated = periodFinancials([jul, aug], actual, classified, budgetWithFuture)
assert(consolidated.revenue === 2400, 'consolidado soma receitas dos meses com dados')
assert(consolidated.realized === 1160, 'consolidado soma custo + despesa dos meses com dados')
assert(consolidated.budgeted === 1100, 'consolidado soma orçado dos meses com dados')

const byMoneyGroup = {
  items: [
    { moneyGroup: 'revenue' as const, categoryType: null, amounts: { '2026-08': 900 } },
    { moneyGroup: 'cost' as const, categoryType: null, amounts: { '2026-08': 300 } },
    { moneyGroup: 'expense' as const, categoryType: null, amounts: { '2026-08': 100 } },
    { moneyGroup: 'investment' as const, categoryType: null, amounts: { '2026-08': 50 } },
  ],
}
const groupSnapshot = monthFinancials(aug, byMoneyGroup, [], null)
assert(groupSnapshot.revenue === 900, 'receita pelo grupo')
assert(groupSnapshot.costs === 300, 'custo pelo grupo')
assert(groupSnapshot.expenses === 100, 'despesa pelo grupo')
assert(groupSnapshot.realized === 400, 'investimento fora do realizado')
assert(groupSnapshot.profit === 500, 'lucro ignora investimento')

console.log('dashboard model tests ok')
