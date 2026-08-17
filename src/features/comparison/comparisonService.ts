import { supabase } from '@/lib/supabase'
import { getCompanyActualByBudget } from '@/features/actual/actualService'
import { getCompanyBudget, listCompanyBudgets } from '@/features/budget/budgetService'
import type { LoadedBudget } from '@/features/budget/model'
import type { LoadedActual } from '@/features/actual/model'
import type { SystemIndicator } from '@/types/database'

export interface ComparisonPair {
  budget: LoadedBudget
  actual: LoadedActual | null
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
  const actual = await getCompanyActualByBudget(companyId, budgetId)
  return { budget, actual }
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
