export type CompanyRole = 'owner' | 'admin' | 'member' | 'viewer'

export interface Profile {
  id: string
  name: string
  email: string | null
  created_at: string
  updated_at: string
}

export interface Company {
  id: string
  name: string
  trade_name: string | null
  document: string | null
  created_at: string
  updated_at: string
}

export interface CompanyUser {
  id: string
  company_id: string
  user_id: string
  role: CompanyRole
  created_at: string
}

export type CategoryType = 'revenue' | 'expense' | 'cost'
export type BudgetPeriodKind = 'calendar_year' | 'custom'
export type BudgetStatus = 'draft' | 'active' | 'archived'

export interface BusinessUnit {
  id: string
  company_id: string
  name: string
  code: string | null
  description: string | null
  is_active: boolean
}

export interface Department {
  id: string
  company_id: string
  name: string
  description: string | null
  is_active: boolean
}

export interface CostCenter {
  id: string
  company_id: string
  name: string
  code: string | null
  description: string | null
  is_active: boolean
}

export interface DepartmentCostCenter {
  id: string
  department_id: string
  cost_center_id: string
}

export interface Category {
  id: string
  company_id: string
  name: string
  category_type: CategoryType
  parent_id: string | null
  is_active: boolean
}

export interface Activity {
  id: string
  code: string
  name: string
  description: string | null
  segment_id: string | null
}

export interface Budget {
  id: string
  company_id: string
  name: string
  fiscal_year: number
  period_label: string
  period_kind: BudgetPeriodKind
  start_date: string
  end_date: string
  business_unit_id: string | null
  notes: string | null
  status: BudgetStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface BudgetItem {
  id: string
  budget_id: string
  company_id: string
  business_unit_id: string | null
  department_id: string
  cost_center_id: string
  activity_id: string
  category_id: string
  sort_order: number
}

export interface BudgetItemValue {
  id: string
  budget_item_id: string
  company_id: string
  year: number
  month: number
  amount: number
}
