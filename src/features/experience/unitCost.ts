import { roundMoney } from '../budget/money.ts'
import type { BudgetMonth } from '../budget/period.ts'
import { monthKey } from '../budget/period.ts'
import { sum } from '../../lib/money.ts'

export type MonthlyVolumes = Record<string, number>

export const UNIT_VOLUME_PREFIX = 'unit_volume:'

interface CostActual {
  items: Array<{
    categoryType: string | null
    moneyGroup?: string | null
    amounts: Record<string, number>
  }>
}

interface CostSlice {
  monthKey: string
  amount: number
  type: string
  moneyGroup?: string | null
}

export function unitVolumeQuestionCode(indicatorCode: string) {
  return `${UNIT_VOLUME_PREFIX}${indicatorCode}`
}

export function isUnitVolumeQuestion(code: string) {
  return code.startsWith(UNIT_VOLUME_PREFIX)
}

export function parseMonthlyVolumes(value: unknown): MonthlyVolumes {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: MonthlyVolumes = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const amount = typeof raw === 'number' ? raw : Number(raw)
    if (Number.isFinite(amount) && amount > 0) result[key] = amount
  }
  return result
}

export function realizedCostForMonth(
  actual: CostActual | null,
  classified: CostSlice[],
  month: string
): number {
  const fromItems = roundMoney(
    sum(
      (actual?.items ?? [])
        .filter((item) => {
          const group = item.moneyGroup || item.categoryType
          return group === 'cost'
        })
        .map((item) => item.amounts[month] ?? 0)
    )
  )

  const fromClassified = roundMoney(
    sum(
      classified
        .filter((slice) => {
          if (slice.monthKey !== month) return false
          if (slice.moneyGroup) return slice.moneyGroup === 'cost'
          return false
        })
        .map((slice) => slice.amount)
    )
  )

  return roundMoney(fromItems + fromClassified)
}

export function unitCostForMonth(totalCost: number, quantity: number | null | undefined) {
  if (quantity == null || !Number.isFinite(quantity) || quantity <= 0) return null
  if (!Number.isFinite(totalCost)) return null
  return roundMoney(totalCost / quantity)
}

export function defaultUnitCostMonth(
  months: BudgetMonth[],
  preferred?: string | null,
  now = new Date()
): string | null {
  if (preferred && preferred !== 'all' && months.some((item) => item.key === preferred)) {
    return preferred
  }
  if (months.length === 0) return null

  const current = monthKey(now.getFullYear(), now.getMonth() + 1)
  if (months.some((item) => item.key === current)) return current
  return months[months.length - 1]?.key ?? null
}

export function volumeNoun(quantity: number, singular: string, plural: string) {
  return quantity === 1 ? singular : plural
}
