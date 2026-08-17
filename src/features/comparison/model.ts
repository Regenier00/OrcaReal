import type { LoadedBudget, LoadedBudgetItem } from '@/features/budget/model'
import { structureKey } from '@/features/budget/model'
import { roundMoney } from '@/features/budget/money'
import type { BudgetMonth } from '@/features/budget/period'
import { sum } from '@/lib/money'

export type ComparisonMonthKey = 'all' | string
export type ComparisonGroupBy = 'line' | 'department' | 'costCenter'

export interface ComparisonRow {
  key: string
  label: string
  detail?: string
  budget: number
  actual: number
  variance: number
  variancePct: number
}

export interface ComparisonSummary {
  budget: number
  actual: number
  variance: number
  variancePct: number
}

export interface ComparisonLine {
  key: string
  label: string
  detail: string
  department: string
  costCenter: string
  category: string
  budget: Record<string, number>
  actual: Record<string, number>
}

function variancePct(budget: number, actual: number) {
  if (budget === 0) return actual === 0 ? 0 : Number.NaN
  return (actual - budget) / budget
}

function sliceAmounts(
  amounts: Record<string, number>,
  months: BudgetMonth[],
  month: ComparisonMonthKey
) {
  if (month === 'all') {
    return roundMoney(sum(months.map((item) => amounts[item.key] ?? 0)))
  }
  return roundMoney(amounts[month] ?? 0)
}

function itemLabel(item: LoadedBudgetItem) {
  return {
    department: item.departmentName || 'Departamento',
    costCenter: item.costCenterName || 'Centro de custo',
    category: item.categoryName || '',
  }
}

export function buildComparisonLines(
  budget: LoadedBudget | null,
  actual: LoadedBudget | null,
  months: BudgetMonth[]
): ComparisonLine[] {
  const map = new Map<string, ComparisonLine>()

  const add = (
    item: LoadedBudgetItem,
    side: 'budget' | 'actual'
  ) => {
    const key = structureKey(item)
    const names = itemLabel(item)
    const current = map.get(key) ?? {
      key,
      label: names.category
        ? `${names.department} · ${names.category}`
        : names.department,
      detail: names.costCenter,
      department: names.department,
      costCenter: names.costCenter,
      category: names.category,
      budget: Object.fromEntries(months.map((month) => [month.key, 0])),
      actual: Object.fromEntries(months.map((month) => [month.key, 0])),
    }

    for (const month of months) {
      current[side][month.key] = roundMoney(
        (current[side][month.key] ?? 0) + (item.amounts[month.key] ?? 0)
      )
    }
    map.set(key, current)
  }

  for (const item of budget?.items ?? []) add(item, 'budget')
  for (const item of actual?.items ?? []) add(item, 'actual')

  return [...map.values()]
}

export function comparisonTotals(
  lines: ComparisonLine[],
  months: BudgetMonth[],
  month: ComparisonMonthKey
): ComparisonSummary {
  const budget = roundMoney(
    sum(lines.map((line) => sliceAmounts(line.budget, months, month)))
  )
  const actual = roundMoney(
    sum(lines.map((line) => sliceAmounts(line.actual, months, month)))
  )
  const variance = roundMoney(actual - budget)
  return { budget, actual, variance, variancePct: variancePct(budget, actual) }
}

export function comparisonRows(
  lines: ComparisonLine[],
  months: BudgetMonth[],
  month: ComparisonMonthKey,
  groupBy: ComparisonGroupBy
): ComparisonRow[] {
  if (groupBy === 'line') {
    return lines
      .map((line) => {
        const budget = sliceAmounts(line.budget, months, month)
        const actual = sliceAmounts(line.actual, months, month)
        const variance = roundMoney(actual - budget)
        return {
          key: line.key,
          label: line.label,
          detail: line.detail,
          budget,
          actual,
          variance,
          variancePct: variancePct(budget, actual),
        }
      })
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
  }

  const grouped = new Map<string, { budget: number; actual: number }>()
  for (const line of lines) {
    const key = groupBy === 'department' ? line.department : line.costCenter
    const current = grouped.get(key) ?? { budget: 0, actual: 0 }
    current.budget += sliceAmounts(line.budget, months, month)
    current.actual += sliceAmounts(line.actual, months, month)
    grouped.set(key, current)
  }

  return [...grouped.entries()]
    .map(([label, values]) => {
      const budget = roundMoney(values.budget)
      const actual = roundMoney(values.actual)
      const variance = roundMoney(actual - budget)
      return {
        key: label,
        label,
        budget,
        actual,
        variance,
        variancePct: variancePct(budget, actual),
      }
    })
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
}

export function costConcentration(
  lines: ComparisonLine[],
  months: BudgetMonth[],
  month: ComparisonMonthKey,
  top = 2
) {
  const rows = comparisonRows(lines, months, month, 'line')
    .slice()
    .sort((a, b) => b.actual - a.actual)
  const totalActual = sum(rows.map((row) => row.actual))
  const topActual = sum(rows.slice(0, top).map((row) => row.actual))
  return totalActual === 0 ? 0 : topActual / totalActual
}

export function applyActualCut(
  lines: ComparisonLine[],
  percent: number,
  predicate?: (line: ComparisonLine) => boolean
): ComparisonLine[] {
  const factor = 1 - percent / 100
  return lines.map((line) => {
    if (predicate && !predicate(line)) return line
    return {
      ...line,
      actual: Object.fromEntries(
        Object.entries(line.actual).map(([key, value]) => [
          key,
          roundMoney(value * factor),
        ])
      ),
    }
  })
}
