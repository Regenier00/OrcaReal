import { supabase } from '@/lib/supabase'
import type {
  Activity,
  Actual,
  ActualItem,
  ActualItemValue,
  BudgetStatus,
  BusinessUnit,
  Category,
  CategoryType,
  CostCenter,
  Department,
  MoneyGroup,
} from '@/types/database'
import type { DraftActual, LoadedActual } from '@/features/actual/model'
import type { LoadedBudgetItem } from '@/features/budget/model'
import { emptyGroupTotals } from '@/features/budget/model'
import { monthKey } from '@/features/budget/period'

interface ActualRow extends Actual {
  business_unit: Pick<BusinessUnit, 'id' | 'name'> | null
  budget: Pick<Actual, 'id'> & { name: string } | null
  actual_items: ActualItemRow[] | null
}

interface ActualItemRow extends ActualItem {
  business_unit: Pick<BusinessUnit, 'id' | 'name'> | null
  department: Pick<Department, 'id' | 'name'> | null
  cost_center: Pick<CostCenter, 'id' | 'name' | 'code'> | null
  activity: Pick<Activity, 'id' | 'name' | 'code'> | null
  category: Pick<Category, 'id' | 'name' | 'category_type'> | null
  month_values: Pick<ActualItemValue, 'id' | 'year' | 'month' | 'amount'>[] | null
}

const ACTUAL_SELECT = `
  id,
  company_id,
  budget_id,
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
  budget:budgets(id, name),
  actual_items (
    id,
    actual_id,
    company_id,
    business_unit_id,
    department_id,
    cost_center_id,
    activity_id,
    category_id,
    money_group,
    destination_id,
    destination_name,
    sort_order,
    business_unit:business_units(id, name),
    department:departments(id, name),
    cost_center:cost_centers(id, name, code),
    activity:activities(id, name, code),
    category:categories(id, name, category_type),
    month_values:actual_item_values(id, year, month, amount)
  )
`

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function mapItem(row: ActualItemRow): LoadedBudgetItem {
  const amounts: Record<string, number> = {}
  for (const value of row.month_values ?? []) {
    amounts[monthKey(value.year, value.month)] = Number(value.amount)
  }

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
    amounts,
    businessUnitName: asSingle(row.business_unit)?.name ?? null,
    departmentName: asSingle(row.department)?.name ?? '',
    costCenterName: asSingle(row.cost_center)?.name ?? '',
    activityName: asSingle(row.activity)?.name ?? '',
    categoryName: asSingle(row.category)?.name ?? '',
    categoryType: (asSingle(row.category)?.category_type ?? null) as CategoryType | null,
  }
}

function mapActual(row: ActualRow): LoadedActual {
  const items = [...(row.actual_items ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(mapItem)

  return {
    id: row.id,
    companyId: row.company_id,
    budgetId: row.budget_id,
    budgetName: asSingle(row.budget)?.name ?? null,
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
    groupTotals: emptyGroupTotals().map((group) => ({
      ...group,
      amounts: {},
    })),
    items,
  }
}

export async function listCompanyActuals(
  companyId: string
): Promise<LoadedActual[]> {
  const { data, error } = await supabase
    .from('actuals')
    .select(ACTUAL_SELECT)
    .eq('company_id', companyId)
    .neq('status', 'archived')
    .order('fiscal_year', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erro ao listar realizados:', error)
    throw new Error('Não foi possível carregar os realizados desta empresa.')
  }

  return ((data ?? []) as unknown as ActualRow[]).map(mapActual)
}

export async function getCompanyActual(
  companyId: string,
  actualId: string
): Promise<LoadedActual | null> {
  const { data, error } = await supabase
    .from('actuals')
    .select(ACTUAL_SELECT)
    .eq('company_id', companyId)
    .eq('id', actualId)
    .maybeSingle()

  if (error) {
    console.error('Erro ao carregar realizado:', error)
    throw new Error('Não foi possível carregar o realizado.')
  }

  return data ? mapActual(data as unknown as ActualRow) : null
}

export async function getCompanyActualByBudget(
  companyId: string,
  budgetId: string
): Promise<LoadedActual | null> {
  const { data, error } = await supabase
    .from('actuals')
    .select(ACTUAL_SELECT)
    .eq('company_id', companyId)
    .eq('budget_id', budgetId)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Erro ao carregar realizado do orçamento:', error)
    throw new Error('Não foi possível carregar o realizado vinculado a este orçamento.')
  }

  return data ? mapActual(data as unknown as ActualRow) : null
}

function toPayload(draft: DraftActual) {
  return {
    id: draft.id ?? null,
    budget_id: draft.budgetId,
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

function toItemsPayload(draft: DraftActual) {
  return draft.items.map((item) => ({
    business_unit_id: item.businessUnitId || null,
    department_id: item.departmentId || null,
    cost_center_id: item.costCenterId || null,
    activity_id: item.activityId || null,
    category_id: item.categoryId || null,
    money_group: item.moneyGroup || null,
    destination_id: item.destinationId || null,
    destination_name: item.destinationName.trim() || null,
    values: Object.entries(item.amounts).map(([key, amount]) => {
      const [year, month] = key.split('-').map(Number)
      return { year, month, amount }
    }),
  }))
}

export async function saveCompanyActual(
  companyId: string,
  draft: DraftActual
): Promise<string> {
  const { data, error } = await supabase.rpc('save_company_actual', {
    p_company_id: companyId,
    p_actual: toPayload(draft),
    p_items: toItemsPayload(draft),
  })

  if (error) {
    console.error('Erro ao salvar realizado:', error)
    throw new Error(error.message || 'Não foi possível salvar o realizado.')
  }

  return data as string
}

export async function deleteCompanyActual(
  companyId: string,
  actualId: string
): Promise<void> {
  const { error } = await supabase
    .from('actuals')
    .delete()
    .eq('id', actualId)
    .eq('company_id', companyId)

  if (error) {
    console.error('Erro ao excluir realizado:', error)
    throw new Error('Não foi possível excluir o realizado.')
  }
}
