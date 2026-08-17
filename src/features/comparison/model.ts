import type { LoadedBudget, LoadedBudgetItem } from '@/features/budget/model'
import { structureKey } from '@/features/budget/model'
import { roundMoney } from '@/features/budget/money'
import type { BudgetMonth } from '@/features/budget/period'
import { sum } from '@/lib/money'
import type { ClassifiedActualSlice } from '@/features/actual/model'

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
  departmentId: string
  costCenterId: string
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

function emptyMonthMap(months: BudgetMonth[]) {
  return Object.fromEntries(months.map((month) => [month.key, 0]))
}

function createLine(input: {
  key: string
  departmentId: string
  costCenterId: string
  department: string
  costCenter: string
  category?: string
  months: BudgetMonth[]
}): ComparisonLine {
  return {
    key: input.key,
    label: input.costCenter,
    detail: input.department,
    departmentId: input.departmentId,
    costCenterId: input.costCenterId,
    department: input.department,
    costCenter: input.costCenter,
    category: input.category ?? '',
    budget: emptyMonthMap(input.months),
    actual: emptyMonthMap(input.months),
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
    const current = map.get(key) ?? createLine({
      key,
      departmentId: item.departmentId || '',
      costCenterId: item.costCenterId || '',
      department: names.department,
      costCenter: names.costCenter,
      category: names.category,
      months,
    })

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

function findClassifiedTarget(
  lines: ComparisonLine[],
  slice: ClassifiedActualSlice
): ComparisonLine | undefined {
  const exact = lines.find(
    (line) =>
      line.costCenterId === slice.costCenterId &&
      line.departmentId === (slice.departmentId || '')
  )
  if (exact) return exact
  return lines.find((line) => line.costCenterId === slice.costCenterId)
}

export function addClassifiedActualsToLines(
  lines: ComparisonLine[],
  slices: ClassifiedActualSlice[],
  months: BudgetMonth[]
): ComparisonLine[] {
  const next = lines.map((line) => ({
    ...line,
    budget: { ...line.budget },
    actual: { ...line.actual },
  }))
  const monthKeys = new Set(months.map((month) => month.key))

  for (const slice of slices) {
    if (!slice.costCenterId || !monthKeys.has(slice.monthKey) || slice.amount === 0) continue

    let target = findClassifiedTarget(next, slice)
    if (!target) {
      target = createLine({
        key: `tx|${slice.departmentId || ''}|${slice.costCenterId}`,
        departmentId: slice.departmentId || '',
        costCenterId: slice.costCenterId,
        department: slice.departmentName || 'Departamento',
        costCenter: slice.costCenterName || 'Centro de custo',
        months,
      })
      next.push(target)
    }

    target.actual[slice.monthKey] = roundMoney(
      (target.actual[slice.monthKey] ?? 0) + slice.amount
    )
  }

  return next
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
      .filter((row) => row.budget !== 0 || row.actual !== 0)
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
  }

  const grouped = new Map<
    string,
    { label: string; budget: number; actual: number }
  >()
  for (const line of lines) {
    const key =
      groupBy === 'department'
        ? line.departmentId || line.department
        : line.costCenterId || line.costCenter
    const label = groupBy === 'department' ? line.department : line.costCenter
    const current = grouped.get(key) ?? { label, budget: 0, actual: 0 }
    current.budget += sliceAmounts(line.budget, months, month)
    current.actual += sliceAmounts(line.actual, months, month)
    grouped.set(key, current)
  }

  return [...grouped.entries()]
    .map(([key, values]) => {
      const budget = roundMoney(values.budget)
      const actual = roundMoney(values.actual)
      const variance = roundMoney(actual - budget)
      return {
        key,
        label: values.label,
        budget,
        actual,
        variance,
        variancePct: variancePct(budget, actual),
      }
    })
    .filter((row) => row.budget !== 0 || row.actual !== 0)
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
