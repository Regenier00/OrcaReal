import { roundMoney } from '../budget/money.ts'
import type { BudgetMonth } from '../budget/period.ts'
import { sum } from '../../lib/money.ts'

export type MoneySide = 'revenue' | 'cost' | 'expense' | 'investment'

export interface AmountItem {
  categoryType: string | null
  moneyGroup?: string | null
  amounts: Record<string, number>
}

export interface ClassifiedSlice {
  monthKey: string
  amount: number
  type: string
  moneyGroup?: string | null
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

type GroupFilter = MoneySide | MoneySide[] | 'operating' | 'all'

export function resolveItemGroup(item: AmountItem): MoneySide | null {
  const raw = item.moneyGroup || item.categoryType
  if (raw === 'revenue' || raw === 'cost' || raw === 'expense' || raw === 'investment') {
    return raw
  }
  return null
}

export function resolveSliceGroup(slice: ClassifiedSlice): MoneySide | null {
  if (
    slice.moneyGroup === 'revenue' ||
    slice.moneyGroup === 'cost' ||
    slice.moneyGroup === 'expense' ||
    slice.moneyGroup === 'investment'
  ) {
    return slice.moneyGroup
  }
  if (slice.type === 'income') return 'revenue'
  if (slice.type === 'expense') return 'expense'
  return null
}

function matchesGroup(group: MoneySide | null, types: GroupFilter) {
  if (types === 'all') return true
  if (types === 'operating') return group === 'cost' || group === 'expense'
  if (Array.isArray(types)) return group != null && types.includes(group)
  return group === types
}

export function sumItemsForMonth(
  items: AmountItem[] | undefined,
  month: string,
  types: GroupFilter
) {
  return roundMoney(
    sum(
      (items ?? [])
        .filter((item) => matchesGroup(resolveItemGroup(item), types))
        .map((item) => item.amounts[month] ?? 0)
    )
  )
}

export function sumClassifiedForMonth(
  slices: ClassifiedSlice[],
  month: string,
  types: GroupFilter
) {
  return roundMoney(
    sum(
      slices
        .filter(
          (slice) => slice.monthKey === month && matchesGroup(resolveSliceGroup(slice), types)
        )
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
    sumItemsForMonth(actual?.items, month.key, 'revenue') +
      sumClassifiedForMonth(classified, month.key, 'revenue')
  )
  const costs = roundMoney(
    sumItemsForMonth(actual?.items, month.key, 'cost') +
      sumClassifiedForMonth(classified, month.key, 'cost')
  )
  const expenses = roundMoney(
    sumItemsForMonth(actual?.items, month.key, 'expense') +
      sumClassifiedForMonth(classified, month.key, 'expense')
  )
  const realized = roundMoney(costs + expenses)
  const budgeted = sumItemsForMonth(budget?.items, month.key, 'operating')
  const profit = roundMoney(revenue - costs - expenses)
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

export function periodFinancials(
  months: BudgetMonth[],
  actual: { items: AmountItem[] } | null,
  classified: ClassifiedSlice[],
  budget: { items: AmountItem[] } | null
): MonthFinancials {
  const series = buildFinancialSeries(months, actual, classified, budget)
  const revenue = roundMoney(sum(series.map((item) => item.revenue)))
  const costs = roundMoney(sum(series.map((item) => item.costs)))
  const expenses = roundMoney(sum(series.map((item) => item.expenses)))
  const realized = roundMoney(sum(series.map((item) => item.realized)))
  const budgeted = roundMoney(sum(series.map((item) => item.budgeted)))
  const profit = roundMoney(revenue - costs - expenses)
  const margin = revenue > 0 ? profit / revenue : null
  const variance = roundMoney(realized - budgeted)
  const variancePct =
    budgeted === 0 ? (realized === 0 ? 0 : null) : variance / budgeted

  return {
    key: 'all',
    label: 'Período completo',
    shortLabel: 'Período',
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
