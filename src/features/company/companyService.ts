import { supabase } from '@/lib/supabase'
import { mapCompanyError } from '@/features/company/companyErrors'
import { onlyDigits } from '@/features/company/cnpj'
import type { SegmentCode } from '@/features/company/segmentOptions'
import type {
  Company,
  CompanyMember,
  CompanyMembership,
  CompanyProfile,
  CompanySettings,
  CostCenter,
  Department,
  Segment,
} from '@/types/database'

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string }

function fail(error: unknown): ServiceResult<never> {
  return { ok: false, message: mapCompanyError(error) }
}

function asCompany(value: unknown): Company | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Partial<Company>
  if (typeof row.id !== 'string' || typeof row.name !== 'string') return null
  return {
    id: row.id,
    name: row.name,
    trade_name: row.trade_name ?? null,
    document: row.document ?? null,
    description: row.description ?? null,
    created_at: row.created_at ?? '',
    updated_at: row.updated_at ?? '',
  }
}

export async function listUserMemberships(): Promise<
  ServiceResult<CompanyMembership[]>
> {
  const { data, error } = await supabase
    .from('company_users')
    .select('id, company_id, user_id, role, created_at, company:companies(*)')
    .order('created_at', { ascending: true })

  if (error) return fail(error)

  const memberships = (data ?? [])
    .map((row) => {
      const company = asCompany(row.company)
      if (!company) return null
      return {
        id: row.id as string,
        company_id: row.company_id as string,
        user_id: row.user_id as string,
        role: row.role as CompanyMembership['role'],
        created_at: row.created_at as string,
        company,
      } satisfies CompanyMembership
    })
    .filter((row): row is CompanyMembership => Boolean(row))

  return { ok: true, data: memberships }
}

export async function createUserCompany(input: {
  name: string
  tradeName?: string
  document?: string
  description?: string
  segmentCode: SegmentCode
  customSegment?: string
}): Promise<ServiceResult<Company>> {
  const name = input.name.trim()
  const tradeName = input.tradeName?.trim() || null
  const description = input.description?.trim() || null
  const customSegment = input.customSegment?.trim() || null
  const document = input.document?.trim()
    ? onlyDigits(input.document)
    : null

  const { data, error } = await supabase.rpc('create_user_company', {
    p_name: name,
    p_trade_name: tradeName,
    p_document: document,
    p_description: description,
    p_segment_code: input.segmentCode,
    p_custom_segment: customSegment,
  })

  if (error) return fail(error)

  const company = asCompany(data)
  if (!company) {
    return {
      ok: false,
      message: 'A empresa não pôde ser criada. Tente novamente.',
    }
  }

  return { ok: true, data: company }
}

export async function setupCompanyEnvironment(input: {
  companyId: string
  name?: string
  segmentCode?: SegmentCode | string
  customSegment?: string
  departments?: string[]
  costCenters?: Array<{ name: string; code?: string }>
  skip?: boolean
}): Promise<ServiceResult<Company>> {
  const { data, error } = await supabase.rpc('setup_company_environment', {
    p_company_id: input.companyId,
    p_name: input.name?.trim() || null,
    p_segment_code: input.segmentCode || null,
    p_custom_segment: input.customSegment?.trim() || null,
    p_departments: (input.departments ?? []).map((item) => item.trim()).filter(Boolean),
    p_cost_centers: (input.costCenters ?? [])
      .map((item) => ({
        name: item.name.trim(),
        code: item.code?.trim() || null,
      }))
      .filter((item) => item.name),
    p_skip: Boolean(input.skip),
  })

  if (error) return fail(error)

  const company = asCompany(data)
  if (!company) {
    return {
      ok: false,
      message: 'Não foi possível salvar a configuração da empresa.',
    }
  }

  return { ok: true, data: company }
}

export async function getCompanyProfile(
  companyId: string
): Promise<ServiceResult<CompanyProfile | null>> {
  const { data, error } = await supabase
    .from('company_profiles')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) return fail(error)
  return { ok: true, data: (data as CompanyProfile | null) ?? null }
}

export async function listSegments(): Promise<ServiceResult<Segment[]>> {
  const { data, error } = await supabase
    .from('segments')
    .select('id, code, name, description')
    .order('name')

  if (error) return fail(error)
  return { ok: true, data: (data as Segment[]) ?? [] }
}

export async function updateCompanyData(input: {
  companyId: string
  name: string
  tradeName?: string
  document?: string
  description?: string
}): Promise<ServiceResult<Company>> {
  const { data, error } = await supabase
    .from('companies')
    .update({
      name: input.name.trim(),
      trade_name: input.tradeName?.trim() || null,
      document: input.document?.trim() ? onlyDigits(input.document) : null,
      description: input.description?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.companyId)
    .select()
    .single()

  if (error) return fail(error)

  const company = asCompany(data)
  if (!company) {
    return { ok: false, message: 'Não foi possível atualizar a empresa.' }
  }
  return { ok: true, data: company }
}

export async function updateCompanySegment(input: {
  companyId: string
  segmentId: string | null
  customSegment?: string
}): Promise<ServiceResult<CompanyProfile>> {
  const { data, error } = await supabase
    .from('company_profiles')
    .update({
      segment_id: input.segmentId,
      custom_segment: input.customSegment?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', input.companyId)
    .select()
    .single()

  if (error) return fail(error)
  return { ok: true, data: data as CompanyProfile }
}

export async function listCompanyMembers(
  companyId: string
): Promise<ServiceResult<CompanyMember[]>> {
  const { data, error } = await supabase
    .from('company_users')
    .select('id, company_id, user_id, role, created_at, profile:profiles(id, name, email)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })

  if (error) return fail(error)

  const members = (data ?? []).map((row) => {
    const rawProfile = row.profile as CompanyMember['profile'] | CompanyMember['profile'][] | null
    const profile = Array.isArray(rawProfile) ? (rawProfile[0] ?? null) : rawProfile

    return {
      id: row.id as string,
      company_id: row.company_id as string,
      user_id: row.user_id as string,
      role: row.role as CompanyMember['role'],
      created_at: row.created_at as string,
      profile,
    }
  })

  return { ok: true, data: members }
}

export async function listDepartments(
  companyId: string
): Promise<ServiceResult<Department[]>> {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .eq('company_id', companyId)
    .order('name')

  if (error) return fail(error)
  return { ok: true, data: (data as Department[]) ?? [] }
}

export async function createDepartment(input: {
  companyId: string
  name: string
  description?: string
}): Promise<ServiceResult<Department>> {
  const { data, error } = await supabase
    .from('departments')
    .insert({
      company_id: input.companyId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
    })
    .select()
    .single()

  if (error) return fail(error)
  return { ok: true, data: data as Department }
}

export async function deleteDepartment(
  departmentId: string
): Promise<ServiceResult<true>> {
  const { error } = await supabase.from('departments').delete().eq('id', departmentId)
  if (error) return fail(error)
  return { ok: true, data: true }
}

export async function listCostCenters(
  companyId: string
): Promise<ServiceResult<CostCenter[]>> {
  const { data, error } = await supabase
    .from('cost_centers')
    .select('*')
    .eq('company_id', companyId)
    .order('name')

  if (error) return fail(error)
  return { ok: true, data: (data as CostCenter[]) ?? [] }
}

export async function createCostCenter(input: {
  companyId: string
  name: string
  code?: string
}): Promise<ServiceResult<CostCenter>> {
  const { data, error } = await supabase
    .from('cost_centers')
    .insert({
      company_id: input.companyId,
      name: input.name.trim(),
      code: input.code?.trim() || null,
    })
    .select()
    .single()

  if (error) return fail(error)
  return { ok: true, data: data as CostCenter }
}

export async function deleteCostCenter(
  costCenterId: string
): Promise<ServiceResult<true>> {
  const { error } = await supabase.from('cost_centers').delete().eq('id', costCenterId)
  if (error) return fail(error)
  return { ok: true, data: true }
}

export async function getCompanySettings(
  companyId: string
): Promise<ServiceResult<CompanySettings | null>> {
  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) return fail(error)
  return { ok: true, data: (data as CompanySettings | null) ?? null }
}

export async function updateCompanySettings(input: {
  companyId: string
  settings: Record<string, unknown>
}): Promise<ServiceResult<CompanySettings>> {
  const { data, error } = await supabase
    .from('company_settings')
    .update({
      settings: input.settings,
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', input.companyId)
    .select()
    .single()

  if (error) return fail(error)
  return { ok: true, data: data as CompanySettings }
}
