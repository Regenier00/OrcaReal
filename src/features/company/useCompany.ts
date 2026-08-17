import { useContext } from 'react'
import { CompanyContext } from '@/features/company/company-context'

export function useCompany() {
  const ctx = useContext(CompanyContext)
  if (!ctx) {
    throw new Error('useCompany deve ser usado dentro de CompanyProvider')
  }
  return ctx
}
