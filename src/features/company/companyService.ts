import { supabase } from '@/lib/supabase'
import type { Company } from '@/types/database'

export async function listUserCompanies(): Promise<Company[]> {
  const { data, error } = await supabase
    .from('company_users')
    .select('company:companies(*)')

  if (error) {
    console.error('Erro ao listar empresas:', error)
    return []
  }

  return (data ?? [])
    .map((row) => row.company as unknown as Company | null)
    .filter((company): company is Company => Boolean(company))
}

export async function createCompany(input: {
  name: string
  tradeName?: string
  document?: string
}): Promise<Company | null> {
  const { data, error } = await supabase.rpc('create_company_with_defaults', {
    p_name: input.name,
    p_trade_name: input.tradeName ?? null,
    p_document: input.document ?? null,
  })

  if (error) {
    console.error('Erro ao criar empresa:', error)
    return null
  }

  return data as Company
}
