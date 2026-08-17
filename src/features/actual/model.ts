import type { BudgetPeriodKind, BudgetStatus } from '@/types/database'
import type {
  DraftBudget,
  DraftBudgetItem,
  LoadedBudget,
  LoadedBudgetItem,
} from '@/features/budget/model'
import { emptyAmounts, remapAmounts } from '@/features/budget/model'
import type { BudgetMonth } from '@/features/budget/period'

export interface DraftActual extends DraftBudget {
  budgetId: string
}

export interface LoadedActual extends LoadedBudget {
  budgetId: string
  budgetName: string | null
}

export function toDraftActual(actual: LoadedActual): DraftActual {
  return {
    id: actual.id,
    budgetId: actual.budgetId,
    name: actual.name,
    fiscalYear: actual.fiscalYear,
    periodLabel: actual.periodLabel,
    periodKind: actual.periodKind as BudgetPeriodKind,
    startDate: actual.startDate,
    endDate: actual.endDate,
    businessUnitId: actual.businessUnitId,
    notes: actual.notes,
    status: actual.status as BudgetStatus,
    items: actual.items.map((item) => ({
      localId: item.localId,
      businessUnitId: item.businessUnitId,
      departmentId: item.departmentId,
      costCenterId: item.costCenterId,
      activityId: item.activityId,
      categoryId: item.categoryId,
      amounts: { ...item.amounts },
    })),
  }
}

export function draftFromBudget(
  budget: LoadedBudget,
  months: BudgetMonth[],
  name: string
): DraftActual {
  return {
    budgetId: budget.id,
    name,
    fiscalYear: budget.fiscalYear,
    periodLabel: budget.periodLabel,
    periodKind: budget.periodKind,
    startDate: budget.startDate,
    endDate: budget.endDate,
    businessUnitId: budget.businessUnitId,
    notes: '',
    status: 'draft',
    items: budget.items.map((item) => copyItemFromBudget(item, months)),
  }
}

function copyItemFromBudget(
  item: LoadedBudgetItem,
  months: BudgetMonth[]
): DraftBudgetItem {
  return {
    localId: crypto.randomUUID(),
    businessUnitId: item.businessUnitId,
    departmentId: item.departmentId,
    costCenterId: item.costCenterId,
    activityId: item.activityId,
    categoryId: item.categoryId,
    amounts: emptyAmounts(months),
  }
}

export function alignActualToBudget(
  draft: DraftActual,
  budget: LoadedBudget,
  months: BudgetMonth[]
): DraftActual {
  const existing = new Map(
    draft.items.map((item) => [
      [item.businessUnitId || '', item.departmentId, item.costCenterId].join('|'),
      item,
    ])
  )

  const items = budget.items.map((item) => {
    const key = [
      item.businessUnitId || '',
      item.departmentId,
      item.costCenterId,
    ].join('|')
    const current = existing.get(key)
    if (current) {
      return {
        ...current,
        amounts: remapAmounts(current.amounts, months),
      }
    }
    return copyItemFromBudget(item, months)
  })

  return {
    ...draft,
    budgetId: budget.id,
    fiscalYear: budget.fiscalYear,
    periodLabel: budget.periodLabel,
    periodKind: budget.periodKind,
    startDate: budget.startDate,
    endDate: budget.endDate,
    businessUnitId: budget.businessUnitId,
    items,
  }
}
