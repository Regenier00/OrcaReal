import { supabase } from '@/lib/supabase'

export {
  assertCanImportWithBudget,
  BUDGET_REQUIRED_FOR_IMPORT_MESSAGE,
} from '@/features/budget/budgetRules'

export async function companyHasBudgets(companyId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('budgets')
    .select('id')
    .eq('company_id', companyId)
    .neq('status', 'archived')
    .limit(1)

  if (error) {
    console.error('Erro ao verificar orçamentos:', error)
    throw new Error('Não foi possível verificar se a empresa já tem orçamento.')
  }

  return (data?.length ?? 0) > 0
}
