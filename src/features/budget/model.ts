import type { BudgetPeriodKind, BudgetStatus, CategoryType } from '@/types/database'
import type { BudgetMonth } from '@/features/budget/period'
import { applyPercent, distributeEqually, roundMoney } from '@/features/budget/money'
import { sum } from '@/lib/money'

export interface DraftBudgetItem {
  localId: string
  businessUnitId: string
  departmentId: string
  costCenterId: string
  activityId?: string
  categoryId?: string
  amounts: Record<string, number>
}

export interface DraftBudget {
  id?: string
  name: string
  fiscalYear: number
  periodLabel: string
  periodKind: BudgetPeriodKind
  startDate: string
  endDate: string
  businessUnitId: string
  notes: string
  status: BudgetStatus
  items: DraftBudgetItem[]
}

export interface NamedRef {
  id: string
  name: string
  code?: string | null
  category_type?: CategoryType
}

export interface LoadedBudgetItem extends DraftBudgetItem {
  id: string
  businessUnitName: string | null
  departmentName: string
  costCenterName: string
  activityName: string
  categoryName: string
  categoryType: CategoryType | null
}

export interface LoadedBudget extends DraftBudget {
  id: string
  companyId: string
  createdAt: string
  updatedAt: string
  businessUnitName: string | null
  items: LoadedBudgetItem[]
}

export function newLocalId() {
  return crypto.randomUUID()
}

export function emptyAmounts(months: BudgetMonth[]): Record<string, number> {
  return Object.fromEntries(months.map((month) => [month.key, 0]))
}

export function structureKey(
  item: Pick<DraftBudgetItem, 'businessUnitId' | 'departmentId' | 'costCenterId'>
) {
  return [item.businessUnitId || '', item.departmentId, item.costCenterId].join(
    '|'
  )
}

export function lineTotal(item: DraftBudgetItem, months: BudgetMonth[]) {
  return roundMoney(sum(months.map((month) => item.amounts[month.key] ?? 0)))
}

export function monthTotal(
  items: DraftBudgetItem[],
  monthKey: string
) {
  return roundMoney(sum(items.map((item) => item.amounts[monthKey] ?? 0)))
}

export function grandTotal(items: DraftBudgetItem[], months: BudgetMonth[]) {
  return roundMoney(sum(items.map((item) => lineTotal(item, months))))
}

export function remapAmounts(
  amounts: Record<string, number>,
  months: BudgetMonth[]
): Record<string, number> {
  return Object.fromEntries(
    months.map((month) => [month.key, roundMoney(amounts[month.key] ?? 0)])
  )
}

export function copyValueToAllMonths(
  _amounts: Record<string, number>,
  months: BudgetMonth[],
  value: number
) {
  const next = roundMoney(value)
  return Object.fromEntries(months.map((month) => [month.key, next]))
}

export function copyPreviousMonths(
  amounts: Record<string, number>,
  months: BudgetMonth[]
) {
  const next = { ...amounts }
  for (let index = 1; index < months.length; index += 1) {
    next[months[index].key] = roundMoney(next[months[index - 1].key] ?? 0)
  }
  return next
}

export function clearAmounts(months: BudgetMonth[]) {
  return emptyAmounts(months)
}

export function distributeAmounts(total: number, months: BudgetMonth[]) {
  const parts = distributeEqually(total, months.length)
  return Object.fromEntries(months.map((month, index) => [month.key, parts[index] ?? 0]))
}

export function applyPercentToAmounts(
  amounts: Record<string, number>,
  months: BudgetMonth[],
  percent: number
) {
  return Object.fromEntries(
    months.map((month) => [
      month.key,
      applyPercent(amounts[month.key] ?? 0, percent),
    ])
  )
}

export function duplicateItem(
  item: DraftBudgetItem,
  months: BudgetMonth[]
): DraftBudgetItem {
  return {
    ...item,
    localId: newLocalId(),
    amounts: remapAmounts(item.amounts, months),
  }
}

export const BUDGET_STATUS_LABEL: Record<BudgetStatus, string> = {
  draft: 'Rascunho',
  active: 'Ativo',
  archived: 'Arquivado',
}

export function createEmptyItem(
  months: BudgetMonth[],
  businessUnitId = ''
): DraftBudgetItem {
  return {
    localId: newLocalId(),
    businessUnitId,
    departmentId: '',
    costCenterId: '',
    amounts: emptyAmounts(months),
  }
}
