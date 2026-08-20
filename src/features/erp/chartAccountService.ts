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
    .order('account_code', { ascending: true })

  if (error) {
    console.error('Erro ao listar plano de contas:', error)
    return {
      ok: false,
      message: 'Não foi possível carregar a classificação.',
    }
  }
  return { ok: true, data: (data ?? []) as CompanyChartAccount[] }
}

export async function createCompanyChartAccount(input: {
  companyId: string
  accountCode: string
  accountName?: string
  matchKind?: ChartAccountMatchKind
  moneyGroup: MoneyGroup
  destinationName?: string
  priority?: number
}): Promise<ChartAccountResult<CompanyChartAccount>> {
  const code = input.accountCode.trim()
  if (!code) {
    return { ok: false, message: 'Informe o prefixo da conta.' }
  }

  const { data, error } = await supabase.rpc('upsert_company_chart_account', {
    p_company_id: input.companyId,
    p_account_code: code,
    p_account_name: input.accountName?.trim() || null,
    p_match_kind: input.matchKind ?? 'prefix',
    p_money_group: input.moneyGroup,
    p_destination_id: null,
    p_destination_name:
      input.destinationName?.trim() || 'Centro de custo do arquivo',
    p_department_id: null,
    p_cost_center_id: null,
    p_priority: input.priority ?? 40,
  })

  if (error) {
    console.error('Erro ao salvar prefixo:', error)
    return {
      ok: false,
      message: error.message || 'Não foi possível salvar o prefixo.',
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
      message: 'Prefixo salvo, mas não foi possível recarregar o registro.',
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
    console.error('Erro ao remover prefixo:', error)
    return {
      ok: false,
      message: error.message || 'Não foi possível remover o prefixo.',
    }
  }
  return { ok: true, data: true }
}
