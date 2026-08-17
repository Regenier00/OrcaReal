import { supabase } from '@/lib/supabase'
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

const emptyStructure: CompanyStructure = {
  businessUnits: [],
  departments: [],
  costCenters: [],
  departmentCostCenters: [],
  categories: [],
  activities: [],
}

export async function loadCompanyStructure(
  companyId: string
): Promise<CompanyStructure> {
  const [
    businessUnitsRes,
    departmentsRes,
    costCentersRes,
    linksRes,
    categoriesRes,
    companyActivitiesRes,
  ] = await Promise.all([
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
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('cost_centers')
      .select('id, company_id, name, code, description, is_active')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('code'),
    supabase
      .from('department_cost_centers')
      .select('id, department_id, cost_center_id'),
    supabase
      .from('categories')
      .select('id, company_id, name, category_type, parent_id, is_active')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('company_activities')
      .select('activity:activities(id, code, name, description, segment_id)')
      .eq('company_id', companyId),
  ])

  const firstError =
    businessUnitsRes.error ||
    departmentsRes.error ||
    costCentersRes.error ||
    linksRes.error ||
    categoriesRes.error ||
    companyActivitiesRes.error

  if (firstError) {
    console.error('Erro ao carregar estrutura da empresa:', firstError)
    return emptyStructure
  }

  let activities = (companyActivitiesRes.data ?? [])
    .map((row) => row.activity as unknown as Activity | Activity[] | null)
    .flatMap((activity) => (Array.isArray(activity) ? activity : [activity]))
    .filter((activity): activity is Activity => Boolean(activity))

  if (activities.length === 0) {
    const { data, error } = await supabase
      .from('activities')
      .select('id, code, name, description, segment_id')
      .order('name')

    if (error) {
      console.error('Erro ao carregar atividades:', error)
    } else {
      activities = (data ?? []) as Activity[]
    }
  }

  const departmentIds = new Set(
    (departmentsRes.data ?? []).map((item) => item.id)
  )

  return {
    businessUnits: (businessUnitsRes.data ?? []) as BusinessUnit[],
    departments: (departmentsRes.data ?? []) as Department[],
    costCenters: (costCentersRes.data ?? []) as CostCenter[],
    departmentCostCenters: ((linksRes.data ?? []) as DepartmentCostCenter[]).filter(
      (link) => departmentIds.has(link.department_id)
    ),
    categories: (categoriesRes.data ?? []) as Category[],
    activities,
  }
}

export function costCentersForDepartment(
  structure: CompanyStructure,
  departmentId: string
): CostCenter[] {
  const linkedIds = structure.departmentCostCenters
    .filter((link) => link.department_id === departmentId)
    .map((link) => link.cost_center_id)

  if (linkedIds.length === 0) return structure.costCenters

  const allowed = new Set(linkedIds)
  return structure.costCenters.filter((item) => allowed.has(item.id))
}
