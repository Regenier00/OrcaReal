import { roundMoney } from '../budget/money.ts'
import type { BudgetMonth } from '../budget/period.ts'
import { sum } from '../../lib/money.ts'

export interface AmountItem {
  categoryType: string | null
  amounts: Record<string, number>
}

export interface ClassifiedSlice {
  monthKey: string
  amount: number
  type: string
}

export interface MonthFinancials {
  key: string
  label: string
  shortLabel: string
  revenue: number
  costs: number
  expenses: number
  realized: number
  budgeted: number
  profit: number
  margin: number | null
  variance: number
  variancePct: number | null
}

type CategoryFilter = Array<string | null> | 'non-revenue' | 'all'

export function sumItemsForMonth(
  items: AmountItem[] | undefined,
  month: string,
  types: CategoryFilter
) {
  return roundMoney(
    sum(
      (items ?? [])
        .filter((item) => matchesCategory(item.categoryType, types))
        .map((item) => item.amounts[month] ?? 0)
    )
  )
}

export function sumClassifiedForMonth(
  slices: ClassifiedSlice[],
  month: string,
  types: string[]
) {
  return roundMoney(
    sum(
      slices
        .filter((slice) => slice.monthKey === month && types.includes(slice.type))
        .map((slice) => slice.amount)
    )
  )
}

export function changeRatio(
  current: number,
  previous: number | null | undefined
): number | null {
  if (previous == null || !Number.isFinite(previous) || !Number.isFinite(current)) {
    return null
  }
  if (previous === 0) return current === 0 ? 0 : null
  return (current - previous) / previous
}

export function previousMonth(
  months: BudgetMonth[],
  monthKey: string
): BudgetMonth | null {
  const index = months.findIndex((item) => item.key === monthKey)
  if (index <= 0) return null
  return months[index - 1] ?? null
}

export function monthFinancials(
  month: BudgetMonth,
  actual: { items: AmountItem[] } | null,
  classified: ClassifiedSlice[],
  budget: { items: AmountItem[] } | null
): MonthFinancials {
  const revenue = roundMoney(
    sumItemsForMonth(actual?.items, month.key, ['revenue']) +
      sumClassifiedForMonth(classified, month.key, ['income'])
  )
  const costs = sumItemsForMonth(actual?.items, month.key, ['cost'])
  const expenses = roundMoney(
    sumItemsForMonth(actual?.items, month.key, ['expense']) +
      sumClassifiedForMonth(classified, month.key, ['expense'])
  )
  const realized = roundMoney(
    sumItemsForMonth(actual?.items, month.key, 'non-revenue') +
      sumClassifiedForMonth(classified, month.key, ['expense'])
  )
  const budgeted = sumItemsForMonth(budget?.items, month.key, 'non-revenue')
  const profit = roundMoney(revenue - realized)
  const margin = revenue > 0 ? profit / revenue : null
  const variance = roundMoney(realized - budgeted)
  const variancePct =
    budgeted === 0 ? (realized === 0 ? 0 : null) : variance / budgeted

  return {
    key: month.key,
    label: month.fullLabel,
    shortLabel: month.label,
    revenue,
    costs,
    expenses,
    realized,
    budgeted,
    profit,
    margin,
    variance,
    variancePct,
  }
}

export function buildFinancialSeries(
  months: BudgetMonth[],
  actual: { items: AmountItem[] } | null,
  classified: ClassifiedSlice[],
  budget: { items: AmountItem[] } | null
): MonthFinancials[] {
  return months
    .map((month) => monthFinancials(month, actual, classified, budget))
    .filter((item) => item.budgeted !== 0 || item.realized !== 0)
}

function matchesCategory(categoryType: string | null, types: CategoryFilter) {
  if (types === 'all') return true
  if (types === 'non-revenue') return categoryType !== 'revenue'
  return types.includes(categoryType)
}
