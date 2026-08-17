import { createContext } from 'react'
import type { Company } from '@/types/database'

export interface CompanyContextValue {
  companies: Company[]
  company: Company | null
  loading: boolean
  selectCompany: (companyId: string) => void
  refreshCompanies: () => Promise<void>
}

export const CompanyContext = createContext<CompanyContextValue | undefined>(
  undefined
)
