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
