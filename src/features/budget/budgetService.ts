import { supabase } from '@/lib/supabase'
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
} from '@/types/database'
import type { DraftBudget, LoadedBudget, LoadedBudgetItem } from '@/features/budget/model'
import { monthKey } from '@/features/budget/period'

interface BudgetRow extends Budget {
  business_unit: Pick<BusinessUnit, 'id' | 'name'> | null
  budget_items: BudgetItemRow[] | null
}

interface BudgetItemRow extends BudgetItem {
  business_unit: Pick<BusinessUnit, 'id' | 'name'> | null
  department: Pick<Department, 'id' | 'name'> | null
  cost_center: Pick<CostCenter, 'id' | 'name' | 'code'> | null
  activity: Pick<Activity, 'id' | 'name' | 'code'> | null
  category: Pick<Category, 'id' | 'name' | 'category_type'> | null
  month_values: Pick<BudgetItemValue, 'id' | 'year' | 'month' | 'amount'>[] | null
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
  budget_items (
    id,
    budget_id,
    company_id,
    business_unit_id,
    department_id,
    cost_center_id,
    activity_id,
    category_id,
    sort_order,
    business_unit:business_units(id, name),
    department:departments(id, name),
    cost_center:cost_centers(id, name, code),
    activity:activities(id, name, code),
    category:categories(id, name, category_type),
    month_values:budget_item_values(id, year, month, amount)
  )
`

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function mapItem(row: BudgetItemRow): LoadedBudgetItem {
  const amounts: Record<string, number> = {}
  for (const value of row.month_values ?? []) {
    amounts[monthKey(value.year, value.month)] = Number(value.amount)
  }

  return {
    localId: row.id,
    id: row.id,
    businessUnitId: row.business_unit_id ?? '',
    departmentId: row.department_id,
    costCenterId: row.cost_center_id,
    activityId: row.activity_id ?? '',
    categoryId: row.category_id ?? '',
    amounts,
    businessUnitName: asSingle(row.business_unit)?.name ?? null,
    departmentName: asSingle(row.department)?.name ?? 'Departamento',
    costCenterName: asSingle(row.cost_center)?.name ?? 'Centro de custo',
    activityName: asSingle(row.activity)?.name ?? '',
    categoryName: asSingle(row.category)?.name ?? '',
    categoryType: (asSingle(row.category)?.category_type ?? null) as CategoryType | null,
  }
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

function toItemsPayload(draft: DraftBudget) {
  return draft.items.map((item) => ({
    business_unit_id: item.businessUnitId || null,
    department_id: item.departmentId,
    cost_center_id: item.costCenterId,
    activity_id: item.activityId || null,
    category_id: item.categoryId || null,
    values: Object.entries(item.amounts).map(([key, amount]) => {
      const [year, month] = key.split('-').map(Number)
      return { year, month, amount }
    }),
  }))
}

export async function saveCompanyBudget(
  companyId: string,
  draft: DraftBudget
): Promise<string> {
  const { data, error } = await supabase.rpc('save_company_budget', {
    p_company_id: companyId,
    p_budget: toPayload(draft),
    p_items: toItemsPayload(draft),
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
    items: budget.items.map((item) => ({
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
