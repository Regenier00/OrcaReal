import { createContext } from 'react'
import type {
  Company,
  CompanyMembership,
  CompanyProfile,
  Segment,
} from '@/types/database'

export interface CompanyContextValue {
  memberships: CompanyMembership[]
  companies: Company[]
  activeCompany: Company | null
  activeMembership: CompanyMembership | null
  companyProfile: CompanyProfile | null
  segments: Segment[]
  loading: boolean
  error: string | null
  isAdmin: boolean
  setActiveCompanyId: (companyId: string) => void
  refresh: () => Promise<void>
}

export const CompanyContext = createContext<CompanyContextValue | undefined>(
  undefined
)
