import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { listUserCompanies } from '@/features/company/companyService'
import { CompanyContext } from '@/features/company/company-context'
import type { Company } from '@/types/database'

const STORAGE_KEY = 'orcareal.selectedCompanyId'

function readStoredCompanyId() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredCompanyId(companyId: string) {
  try {
    localStorage.setItem(STORAGE_KEY, companyId)
  } catch {
    // ignore quota / private mode
  }
}

function pickCompanyId(data: Company[], current: string | null) {
  if (current && data.some((item) => item.id === current)) return current
  const stored = readStoredCompanyId()
  if (stored && data.some((item) => item.id === stored)) return stored
  return data[0]?.id ?? null
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyId, setCompanyId] = useState<string | null>(readStoredCompanyId)
  const [loading, setLoading] = useState(true)

  const refreshCompanies = useCallback(async () => {
    const data = await listUserCompanies()
    setCompanies(data)
    setCompanyId((current) => pickCompanyId(data, current))
    setLoading(false)
  }, [])

  useEffect(() => {
    let mounted = true
    void listUserCompanies().then((data) => {
      if (!mounted) return
      setCompanies(data)
      setCompanyId((current) => pickCompanyId(data, current))
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [])

  const selectCompany = useCallback((nextId: string) => {
    setCompanyId(nextId)
    writeStoredCompanyId(nextId)
  }, [])

  useEffect(() => {
    if (companyId) writeStoredCompanyId(companyId)
  }, [companyId])

  const company = useMemo(
    () => companies.find((item) => item.id === companyId) ?? null,
    [companies, companyId]
  )

  const value = useMemo(
    () => ({
      companies,
      company,
      loading,
      selectCompany,
      refreshCompanies,
    }),
    [companies, company, loading, selectCompany, refreshCompanies]
  )

  return (
    <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
  )
}
