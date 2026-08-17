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
  description: string | null
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

export interface CompanyMembership extends CompanyUser {
  company: Company
}

export interface Segment {
  id: string
  code: string
  name: string
  description: string | null
}

export interface CompanyProfile {
  id: string
  company_id: string
  segment_id: string | null
  custom_segment: string | null
  company_size: string | null
  financial_control_method: string | null
  main_objective: string | null
  maturity_level: string | null
  profile_summary: string | null
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

export interface Department {
  id: string
  company_id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CostCenter {
  id: string
  company_id: string
  name: string
  code: string | null
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CompanySettings {
  id: string
  company_id: string
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CompanyMember {
  id: string
  company_id: string
  user_id: string
  role: CompanyRole
  created_at: string
  profile: Profile | null
}
