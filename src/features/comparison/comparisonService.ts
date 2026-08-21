import { supabase } from '@/lib/supabase'
import {
  getCompanyActualByBudget,
  listClassifiedActualSlices,
} from '@/features/actual/actualService'
import { listClassifiedErpSlices } from '@/features/erp/erpService'
import { getCompanyBudget, listCompanyBudgets } from '@/features/budget/budgetService'
import type { LoadedBudget } from '@/features/budget/model'
import type { ClassifiedActualSlice, LoadedActual } from '@/features/actual/model'
import type { MoneyGroup, SystemIndicator } from '@/types/database'
import type { ComparisonRow, ComparisonSummary } from '@/features/comparison/model'

export interface ComparisonPair {
  budget: LoadedBudget
  actual: LoadedActual | null
  classifiedActuals: ClassifiedActualSlice[]
}

export async function listCompanyComparisonOptions(
  companyId: string
): Promise<LoadedBudget[]> {
  return listCompanyBudgets(companyId)
}

export async function loadComparisonPair(
  companyId: string,
  budgetId: string
): Promise<ComparisonPair | null> {
  const budget = await getCompanyBudget(companyId, budgetId)
  if (!budget) return null
  const [actual, statementSlices, erpSlices] = await Promise.all([
    getCompanyActualByBudget(companyId, budgetId),
    listClassifiedActualSlices(companyId, budget.startDate, budget.endDate),
    listClassifiedErpSlices(companyId, budget.startDate, budget.endDate),
  ])
  return {
    budget,
    actual,
    classifiedActuals: [...statementSlices, ...erpSlices],
  }
}

export async function listSystemIndicators(): Promise<SystemIndicator[]> {
  const { data, error } = await supabase
    .from('system_indicators')
    .select('id, code, name, description, formula_hint, sort_order, is_active')
    .eq('is_active', true)
    .order('sort_order')

  if (error) {
    console.error('Erro ao carregar indicadores:', error)
    return [
      {
        id: 'budget_variance',
        code: 'budget_variance',
        name: 'Desvio Orçamentário',
        description: 'Diferença entre orçado e realizado',
        formula_hint: 'realizado - orçado',
        sort_order: 10,
        is_active: true,
      },
      {
        id: 'budget_variance_pct',
        code: 'budget_variance_pct',
        name: 'Desvio Orçamentário %',
        description: 'Percentual de desvio',
        formula_hint: '(realizado - orçado) / orçado',
        sort_order: 20,
        is_active: true,
      },
      {
        id: 'cost_concentration',
        code: 'cost_concentration',
        name: 'Concentração de Custos',
        description: 'Participação dos maiores custos',
        formula_hint: 'top custos / custo total',
        sort_order: 30,
        is_active: true,
      },
    ]
  }

  return (data ?? []) as SystemIndicator[]
}


export interface BudgetVsActualMonth {
  key: string
  label: string
  year: number
  month: number
}

export interface BudgetVsActualPresentation {
  companyId: string
  budgetId: string
  moneyGroup: MoneyGroup
  monthKey: string
  startDate: string
  endDate: string
  months: BudgetVsActualMonth[]
  hasRealized: boolean
  summary: ComparisonSummary
  rows: ComparisonRow[]
}

/** Orçado × Realizado por grupo — agregação e regras no Postgres. */
export async function loadBudgetVsActualByMoneyGroup(input: {
  companyId: string
  budgetId: string
  moneyGroup: MoneyGroup
  monthKey?: string
}): Promise<BudgetVsActualPresentation> {
  const { data, error } = await supabase.rpc('get_budget_vs_actual_by_money_group', {
    p_company_id: input.companyId,
    p_budget_id: input.budgetId,
    p_money_group: input.moneyGroup,
    p_month_key: input.monthKey ?? 'all',
  })

  if (error) {
    console.error('Erro ao carregar Orçado × Realizado:', error)
    throw new Error(error.message || 'Não foi possível carregar a comparação.')
  }

  const payload = (data ?? {}) as Record<string, unknown>
  const summaryRaw = (payload.summary ?? {}) as Record<string, unknown>
  const budget = Number(summaryRaw.budget ?? 0)
  const actual = Number(summaryRaw.actual ?? 0)
  const variance = Number(summaryRaw.variance ?? actual - budget)
  const variancePctRaw = summaryRaw.variance_pct
  const variancePct =
    variancePctRaw == null || variancePctRaw === ''
      ? Number.NaN
      : Number(variancePctRaw)

  const rowsRaw = Array.isArray(payload.rows) ? payload.rows : []
  const rows: ComparisonRow[] = rowsRaw.map((row) => {
    const item = (row ?? {}) as Record<string, unknown>
    const rowBudget = Number(item.budget ?? 0)
    const rowActual = Number(item.actual ?? 0)
    const rowVariance = Number(item.variance ?? rowActual - rowBudget)
    const rowPct = item.variance_pct
    return {
      key: String(item.key ?? item.label ?? ''),
      label: String(item.label ?? 'Sem destino'),
      budget: rowBudget,
      actual: rowActual,
      variance: rowVariance,
      variancePct:
        rowPct == null || rowPct === '' ? Number.NaN : Number(rowPct),
    }
  })

  const monthsRaw = Array.isArray(payload.months) ? payload.months : []
  const months: BudgetVsActualMonth[] = monthsRaw.map((month) => {
    const item = (month ?? {}) as Record<string, unknown>
    return {
      key: String(item.key ?? ''),
      label: String(item.label ?? item.key ?? ''),
      year: Number(item.year ?? 0),
      month: Number(item.month ?? 0),
    }
  })

  return {
    companyId: String(payload.company_id ?? input.companyId),
    budgetId: String(payload.budget_id ?? input.budgetId),
    moneyGroup: (payload.money_group as MoneyGroup) ?? input.moneyGroup,
    monthKey: String(payload.month_key ?? input.monthKey ?? 'all'),
    startDate: String(payload.start_date ?? ''),
    endDate: String(payload.end_date ?? ''),
    months,
    hasRealized: Boolean(payload.has_realized),
    summary: { budget, actual, variance, variancePct },
    rows,
  }
}
