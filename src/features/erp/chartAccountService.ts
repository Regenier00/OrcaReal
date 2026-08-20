import { supabase } from '@/lib/supabase'
import type {
  ChartAccountMatchKind,
  CompanyChartAccount,
  MoneyGroup,
} from '@/types/database'

const SELECT = `
  id,
  company_id,
  account_code,
  account_name,
  match_kind,
  money_group,
  destination_id,
  destination_name,
  department_id,
  cost_center_id,
  priority,
  is_active,
  created_by,
  created_at,
  updated_at
`

export type ChartAccountResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string }

export async function listCompanyChartAccounts(
  companyId: string,
): Promise<ChartAccountResult<CompanyChartAccount[]>> {
  const { data, error } = await supabase
    .from('company_chart_accounts')
    .select(SELECT)
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('money_group', { ascending: true })
    .order('match_kind', { ascending: true })
    .order('account_code', { ascending: true })

  if (error) {
    console.error('Erro ao listar plano de contas:', error)
    return {
      ok: false,
      message: 'Não foi possível carregar o plano de contas.',
    }
  }
  return { ok: true, data: (data ?? []) as CompanyChartAccount[] }
}

export async function createCompanyChartAccount(input: {
  companyId: string
  accountCode: string
  accountName?: string
  matchKind: ChartAccountMatchKind
  moneyGroup: MoneyGroup
  destinationId?: string | null
  destinationName: string
  priority?: number
}): Promise<ChartAccountResult<CompanyChartAccount>> {
  const code = input.accountCode.trim()
  const destinationName = input.destinationName.trim()
  if (!code) {
    return { ok: false, message: 'Informe o código ou prefixo da conta.' }
  }
  if (!destinationName) {
    return { ok: false, message: 'Informe o destino da classificação.' }
  }

  const { data, error } = await supabase.rpc('upsert_company_chart_account', {
    p_company_id: input.companyId,
    p_account_code: code,
    p_account_name: input.accountName?.trim() || null,
    p_match_kind: input.matchKind,
    p_money_group: input.moneyGroup,
    p_destination_id: input.destinationId ?? null,
    p_destination_name: destinationName,
    p_department_id: null,
    p_cost_center_id: null,
    p_priority: input.priority ?? (input.matchKind === 'prefix' ? 40 : 100),
  })

  if (error) {
    console.error('Erro ao salvar conta do plano:', error)
    return {
      ok: false,
      message: error.message || 'Não foi possível salvar a conta.',
    }
  }

  const { data: row, error: loadError } = await supabase
    .from('company_chart_accounts')
    .select(SELECT)
    .eq('id', data)
    .maybeSingle()

  if (loadError || !row) {
    return {
      ok: false,
      message: 'Conta salva, mas não foi possível recarregar o registro.',
    }
  }
  return { ok: true, data: row as CompanyChartAccount }
}

export async function deleteCompanyChartAccount(
  accountId: string,
): Promise<ChartAccountResult<true>> {
  const { error } = await supabase
    .from('company_chart_accounts')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', accountId)

  if (error) {
    console.error('Erro ao remover conta do plano:', error)
    return {
      ok: false,
      message: error.message || 'Não foi possível remover a conta.',
    }
  }
  return { ok: true, data: true }
}

export async function seedCompanyChartDefaults(
  companyId: string,
): Promise<ChartAccountResult<number>> {
  const { data, error } = await supabase.rpc('seed_company_chart_defaults', {
    p_company_id: companyId,
  })
  if (error) {
    console.error('Erro ao aplicar estrutura padrão:', error)
    return {
      ok: false,
      message: error.message || 'Não foi possível aplicar a estrutura padrão.',
    }
  }
  return { ok: true, data: Number(data ?? 0) }
}
