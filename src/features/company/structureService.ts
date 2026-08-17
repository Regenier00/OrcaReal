import { supabase } from '@/lib/supabase'
import {
  defaultCostCenterNameForDepartment,
  sortCostCentersByDefault,
  sortDepartmentsByDefault,
} from '@/features/company/defaultDepartments'
import type {
  Activity,
  BusinessUnit,
  Category,
  CostCenter,
  Department,
  DepartmentCostCenter,
} from '@/types/database'

export interface CompanyStructure {
  businessUnits: BusinessUnit[]
  departments: Department[]
  costCenters: CostCenter[]
  departmentCostCenters: DepartmentCostCenter[]
  categories: Category[]
  activities: Activity[]
}

export async function loadCompanyStructure(
  companyId: string
): Promise<CompanyStructure> {
  const { error: ensureError } = await supabase.rpc(
    'ensure_company_default_departments',
    { p_company_id: companyId }
  )

  if (ensureError) {
    console.error('Erro ao garantir estrutura padrão:', ensureError)
  }

  const [businessUnitsRes, departmentsRes, costCentersRes] = await Promise.all([
    supabase
      .from('business_units')
      .select('id, company_id, name, code, description, is_active')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('departments')
      .select('id, company_id, name, description, is_active')
      .eq('company_id', companyId)
      .eq('is_active', true),
    supabase
      .from('cost_centers')
      .select('id, company_id, name, code, description, is_active')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('code'),
  ])

  const firstError =
    businessUnitsRes.error || departmentsRes.error || costCentersRes.error

  if (firstError) {
    console.error('Erro ao carregar estrutura da empresa:', firstError)
    throw new Error('Não foi possível carregar a estrutura da empresa.')
  }

  const departments = sortDepartmentsByDefault(
    (departmentsRes.data ?? []) as Department[]
  )
  const costCenters = sortCostCentersByDefault(
    (costCentersRes.data ?? []) as CostCenter[]
  )
  const departmentIds = departments.map((item) => item.id)

  let departmentCostCenters: DepartmentCostCenter[] = []
  if (departmentIds.length > 0) {
    const { data, error } = await supabase
      .from('department_cost_centers')
      .select('id, department_id, cost_center_id')
      .in('department_id', departmentIds)

    if (error) {
      console.error('Erro ao carregar vínculos de centro de custo:', error)
    } else {
      departmentCostCenters = (data ?? []) as DepartmentCostCenter[]
    }
  }

  return {
    businessUnits: (businessUnitsRes.data ?? []) as BusinessUnit[],
    departments,
    costCenters,
    departmentCostCenters,
    categories: [],
    activities: [],
  }
}

export function costCentersForDepartment(
  structure: CompanyStructure,
  departmentId: string
): CostCenter[] {
  if (!departmentId) return []

  const linkedIds = structure.departmentCostCenters
    .filter((link) => link.department_id === departmentId)
    .map((link) => link.cost_center_id)

  const pool =
    linkedIds.length === 0
      ? structure.costCenters
      : structure.costCenters.filter((item) => linkedIds.includes(item.id))

  return sortCostCentersByDefault(pool)
}

export function defaultCostCenterIdForDepartment(
  structure: CompanyStructure,
  departmentId: string
): string {
  const centers = costCentersForDepartment(structure, departmentId)
  if (centers.length === 0) return ''

  const department = structure.departments.find((item) => item.id === departmentId)
  const mappedName = department
    ? defaultCostCenterNameForDepartment(department.name)
    : undefined

  if (mappedName) {
    const mapped = centers.find(
      (item) => item.name.toLowerCase() === mappedName.toLowerCase()
    )
    if (mapped) return mapped.id
  }

  return centers.length === 1 ? centers[0].id : ''
}
