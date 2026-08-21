import { supabase } from '@/lib/supabase'
import {
  assertCanCreateBudget,
  companyHasCostCenters,
} from '@/features/company/costCenterGate'
import type {
  Activity,
  Budget,
  BudgetItem,
  BudgetItemValue,
  BudgetPeriodKind,
  BudgetStatus,
  BusinessUnit,
  Category,
  CategoryType,
  CostCenter,
  Department,
  MoneyGroup,
} from '@/types/database'
import type {
  DraftBudget,
  DraftBudgetAccount,
  LoadedBudget,
  LoadedBudgetItem,
  LoadedGroupTotal,
} from '@/features/budget/model'
import {
  emptyGroupTotals,
  distributeAmounts,
  itemIsDetailed,
  newLocalId,
} from '@/features/budget/model'
import type { BudgetItemAccount, BudgetItemAccountValue } from '@/types/database'
import { monthKey, monthsBetween } from '@/features/budget/period'
import { sum } from '@/lib/money'
import { roundMoney } from '@/features/budget/money'

interface BudgetGroupTotalRow {
  id: string
  money_group: MoneyGroup
  month_values: Pick<BudgetItemValue, 'year' | 'month' | 'amount'>[] | null
}

interface BudgetRow extends Budget {
  business_unit: Pick<BusinessUnit, 'id' | 'name'> | null
  budget_items: BudgetItemRow[] | null
  budget_group_totals: BudgetGroupTotalRow[] | null
}

interface BudgetItemAccountRow extends BudgetItemAccount {
  month_values: Pick<BudgetItemAccountValue, 'id' | 'year' | 'month' | 'amount'>[] | null
}

interface BudgetItemRow extends BudgetItem {
  business_unit: Pick<BusinessUnit, 'id' | 'name'> | null
  department: Pick<Department, 'id' | 'name'> | null
  cost_center: Pick<CostCenter, 'id' | 'name' | 'code'> | null
  activity: Pick<Activity, 'id' | 'name' | 'code'> | null
  category: Pick<Category, 'id' | 'name' | 'category_type'> | null
  month_values: Pick<BudgetItemValue, 'id' | 'year' | 'month' | 'amount'>[] | null
  accounts: BudgetItemAccountRow[] | null
}

const BUDGET_SELECT = `
  id,
  company_id,
  name,
  fiscal_year,
  period_label,
  period_kind,
  start_date,
  end_date,
  business_unit_id,
  notes,
  status,
  created_by,
  created_at,
  updated_at,
  business_unit:business_units(id, name),
  budget_group_totals (
    id,
    money_group,
    month_values:budget_group_total_values(year, month, amount)
  ),
  budget_items (
    id,
    budget_id,
    company_id,
    business_unit_id,
    department_id,
    cost_center_id,
    activity_id,
    category_id,
    money_group,
    destination_id,
    destination_name,
    is_detailed,
    sort_order,
    business_unit:business_units(id, name),
    department:departments(id, name),
    cost_center:cost_centers(id, name, code),
    activity:activities(id, name, code),
    category:categories(id, name, category_type),
    month_values:budget_item_values(id, year, month, amount),
    accounts:budget_item_accounts(
      id,
      budget_item_id,
      company_id,
      ledger_account_id,
      account_code,
      account_name,
      sort_order,
      month_values:budget_item_account_values(id, year, month, amount)
    )
  )
`

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function mapAmounts(
  values: Pick<BudgetItemValue, 'year' | 'month' | 'amount'>[] | null | undefined
) {
  const amounts: Record<string, number> = {}
  for (const value of values ?? []) {
    amounts[monthKey(value.year, value.month)] = Number(value.amount)
  }
  return amounts
}

function mapAccounts(rows: BudgetItemAccountRow[] | null | undefined): DraftBudgetAccount[] {
  return [...(rows ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => ({
      localId: row.id,
      ledgerAccountId: row.ledger_account_id ?? undefined,
      accountCode: row.account_code,
      accountName: row.account_name,
      amounts: mapAmounts(row.month_values),
    }))
}

function mapItem(row: BudgetItemRow): LoadedBudgetItem {
  const accounts = mapAccounts(row.accounts)
  return {
    localId: row.id,
    id: row.id,
    moneyGroup: (row.money_group ?? '') as MoneyGroup | '',
    destinationName: row.destination_name ?? '',
    destinationId: row.destination_id ?? undefined,
    businessUnitId: row.business_unit_id ?? '',
    departmentId: row.department_id ?? '',
    costCenterId: row.cost_center_id ?? '',
    activityId: row.activity_id ?? '',
    categoryId: row.category_id ?? '',
    isDetailed: Boolean(row.is_detailed) || accounts.length > 0,
    accounts,
    amounts: mapAmounts(row.month_values),
    businessUnitName: asSingle(row.business_unit)?.name ?? null,
    departmentName: asSingle(row.department)?.name ?? '',
    costCenterName: asSingle(row.cost_center)?.name ?? '',
    activityName: asSingle(row.activity)?.name ?? '',
    categoryName: asSingle(row.category)?.name ?? '',
    categoryType: (asSingle(row.category)?.category_type ?? null) as CategoryType | null,
  }
}

function mapGroupTotals(
  rows: BudgetGroupTotalRow[] | null | undefined,
  items: LoadedBudgetItem[],
  startDate: string,
  endDate: string
): LoadedGroupTotal[] {
  const months = monthsBetween(startDate, endDate)
  const byGroup = new Map(
    (rows ?? []).map((row) => {
      const amounts = mapAmounts(row.month_values)
      const total = roundMoney(sum(Object.values(amounts)))
      return [row.money_group, { moneyGroup: row.money_group, total, amounts }]
    })
  )

  return emptyGroupTotals().map((group) => {
    const existing = byGroup.get(group.moneyGroup)
    if (existing) return existing

    const itemTotal = roundMoney(
      sum(
        items
          .filter((item) => item.moneyGroup === group.moneyGroup)
          .flatMap((item) => Object.values(item.amounts))
      )
    )
    return {
      moneyGroup: group.moneyGroup,
      total: itemTotal,
      amounts: distributeAmounts(itemTotal, months),
    }
  })
}

function mapBudget(row: BudgetRow): LoadedBudget {
  const items = [...(row.budget_items ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(mapItem)

  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    fiscalYear: row.fiscal_year,
    periodLabel: row.period_label,
    periodKind: row.period_kind,
    startDate: row.start_date,
    endDate: row.end_date,
    businessUnitId: row.business_unit_id ?? '',
    notes: row.notes ?? '',
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    businessUnitName: asSingle(row.business_unit)?.name ?? null,
    groupTotals: mapGroupTotals(
      row.budget_group_totals,
      items,
      row.start_date,
      row.end_date
    ),
    items,
  }
}

export async function listCompanyBudgets(
  companyId: string
): Promise<LoadedBudget[]> {
  const { data, error } = await supabase
    .from('budgets')
    .select(BUDGET_SELECT)
    .eq('company_id', companyId)
    .neq('status', 'archived')
    .order('fiscal_year', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erro ao listar orçamentos:', error)
    throw new Error('Não foi possível carregar os orçamentos desta empresa.')
  }

  return ((data ?? []) as unknown as BudgetRow[]).map(mapBudget)
}

export async function getCompanyBudget(
  companyId: string,
  budgetId: string
): Promise<LoadedBudget | null> {
  const { data, error } = await supabase
    .from('budgets')
    .select(BUDGET_SELECT)
    .eq('company_id', companyId)
    .eq('id', budgetId)
    .maybeSingle()

  if (error) {
    console.error('Erro ao carregar orçamento:', error)
    throw new Error('Não foi possível carregar o orçamento.')
  }

  return data ? mapBudget(data as unknown as BudgetRow) : null
}

function toPayload(draft: DraftBudget) {
  return {
    id: draft.id ?? null,
    name: draft.name.trim(),
    fiscal_year: draft.fiscalYear,
    period_label: draft.periodLabel.trim(),
    period_kind: draft.periodKind,
    start_date: draft.startDate,
    end_date: draft.endDate,
    business_unit_id: draft.businessUnitId || null,
    notes: draft.notes.trim() || null,
    status: 'active' as BudgetStatus,
  }
}

function toValuesPayload(amounts: Record<string, number>) {
  return Object.entries(amounts).map(([key, amount]) => {
    const [year, month] = key.split('-').map(Number)
    return { year, month, amount }
  })
}

function toAccountsPayload(accounts: DraftBudgetAccount[] | undefined) {
  return (accounts ?? []).map((account) => ({
    ledger_account_id: account.ledgerAccountId || null,
    account_code: account.accountCode.trim(),
    account_name: account.accountName.trim(),
    values: toValuesPayload(account.amounts),
  }))
}

function toItemsPayload(draft: DraftBudget) {
  return draft.items.map((item) => {
    const detailed = itemIsDetailed(item)
    return {
      business_unit_id: item.businessUnitId || null,
      department_id: item.departmentId || null,
      cost_center_id: item.costCenterId || null,
      activity_id: item.activityId || null,
      category_id: item.categoryId || null,
      money_group: item.moneyGroup || null,
      destination_id: item.destinationId || null,
      destination_name: item.destinationName.trim() || null,
      is_detailed: detailed,
      values: toValuesPayload(item.amounts),
      accounts: detailed ? toAccountsPayload(item.accounts) : [],
    }
  })
}

function toGroupsPayload(draft: DraftBudget) {
  const months = monthsBetween(draft.startDate, draft.endDate)
  return draft.groupTotals
    .filter((group) => group.total > 0)
    .map((group) => ({
      money_group: group.moneyGroup,
      values: toValuesPayload(distributeAmounts(group.total, months)),
    }))
}

export async function saveCompanyBudget(
  companyId: string,
  draft: DraftBudget
): Promise<string> {
  if (!draft.id) {
    assertCanCreateBudget(await companyHasCostCenters(companyId))
  }

  const { data, error } = await supabase.rpc('save_company_budget', {
    p_company_id: companyId,
    p_budget: toPayload(draft),
    p_items: toItemsPayload(draft),
    p_groups: toGroupsPayload(draft),
  })

  if (error) {
    console.error('Erro ao salvar orçamento:', error)
    throw new Error(error.message || 'Não foi possível salvar o orçamento.')
  }

  return data as string
}

export async function deleteCompanyBudget(
  companyId: string,
  budgetId: string
): Promise<void> {
  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('id', budgetId)
    .eq('company_id', companyId)

  if (error) {
    console.error('Erro ao excluir orçamento:', error)
    throw new Error('Não foi possível excluir o orçamento.')
  }
}

export function toDraft(budget: LoadedBudget): DraftBudget {
  return {
    id: budget.id,
    name: budget.name,
    fiscalYear: budget.fiscalYear,
    periodLabel: budget.periodLabel,
    periodKind: budget.periodKind as BudgetPeriodKind,
    startDate: budget.startDate,
    endDate: budget.endDate,
    businessUnitId: budget.businessUnitId,
    notes: budget.notes,
    status: budget.status,
    groupTotals: emptyGroupTotals().map((group) => {
      const loaded = budget.groupTotals.find(
        (entry) => entry.moneyGroup === group.moneyGroup
      )
      return {
        moneyGroup: group.moneyGroup,
        total: loaded?.total ?? 0,
      }
    }),
    items: budget.items.map((item) => ({
      localId: item.localId,
      moneyGroup: item.moneyGroup,
      destinationName: item.destinationName,
      destinationId: item.destinationId,
      businessUnitId: item.businessUnitId,
      departmentId: item.departmentId,
      costCenterId: item.costCenterId,
      activityId: item.activityId,
      categoryId: item.categoryId,
      isDetailed: item.isDetailed ?? false,
      accounts: (item.accounts ?? []).map((account) => ({
        localId: account.localId || newLocalId(),
        ledgerAccountId: account.ledgerAccountId,
        accountCode: account.accountCode,
        accountName: account.accountName,
        amounts: { ...account.amounts },
      })),
      amounts: { ...item.amounts },
    })),
  }
}
