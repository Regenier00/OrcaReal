import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'
import { CompanyContext } from '@/features/company/company-context'
import {
  getCompanyProfile,
  listSegments,
  listUserMemberships,
} from '@/features/company/companyService'
import type {
  Company,
  CompanyMembership,
  CompanyProfile,
  Segment,
} from '@/types/database'

const ACTIVE_COMPANY_KEY = 'orcareal.activeCompanyId'

function readStoredCompanyId() {
  try {
    return localStorage.getItem(ACTIVE_COMPANY_KEY)
  } catch {
    return null
  }
}

function storeCompanyId(companyId: string) {
  try {
    localStorage.setItem(ACTIVE_COMPANY_KEY, companyId)
  } catch {
    // storage pode estar bloqueado
  }
}

async function fetchCompanySnapshot(): Promise<{
  memberships: CompanyMembership[]
  segments: Segment[]
  nextId: string | null
  profile: CompanyProfile | null
  error: string | null
}> {
  const [membershipResult, segmentResult] = await Promise.all([
    listUserMemberships(),
    listSegments(),
  ])

  if (!membershipResult.ok) {
    return {
      memberships: [],
      segments: segmentResult.ok ? segmentResult.data : [],
      nextId: null,
      profile: null,
      error: membershipResult.message,
    }
  }

  const storedId = readStoredCompanyId()
  const nextId =
    membershipResult.data.find((item) => item.company_id === storedId)
      ?.company_id ??
    membershipResult.data[0]?.company_id ??
    null

  const profileResult = nextId ? await getCompanyProfile(nextId) : null

  return {
    memberships: membershipResult.data,
    segments: segmentResult.ok ? segmentResult.data : [],
    nextId,
    profile: profileResult?.ok ? profileResult.data : null,
    error: null,
  }
}

export function CompanyProvider({ children }: { children?: ReactNode }) {
  const { user } = useAuth()
  const [memberships, setMemberships] = useState<CompanyMembership[]>([])
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(
    readStoredCompanyId
  )
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(
    null
  )
  const [segments, setSegments] = useState<Segment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const applySnapshot = useCallback(
    (snapshot: Awaited<ReturnType<typeof fetchCompanySnapshot>>) => {
      setMemberships(snapshot.memberships)
      setSegments(snapshot.segments)
      setActiveCompanyIdState(snapshot.nextId)
      if (snapshot.nextId) storeCompanyId(snapshot.nextId)
      setCompanyProfile(snapshot.profile)
      setError(snapshot.error)
      setLoading(false)
    },
    []
  )

  const refresh = useCallback(async () => {
    if (!user) {
      setMemberships([])
      setCompanyProfile(null)
      setLoading(false)
      return
    }

    const snapshot = await fetchCompanySnapshot()
    applySnapshot(snapshot)
  }, [user, applySnapshot])

  useEffect(() => {
    if (!user) return

    let cancelled = false
    void fetchCompanySnapshot().then((snapshot) => {
      if (cancelled) return
      applySnapshot(snapshot)
    })

    return () => {
      cancelled = true
    }
  }, [user, applySnapshot])

  const setActiveCompanyId = useCallback(
    (companyId: string) => {
      const exists = memberships.some((item) => item.company_id === companyId)
      if (!exists) return
      storeCompanyId(companyId)
      setActiveCompanyIdState(companyId)
      void getCompanyProfile(companyId).then((result) => {
        setCompanyProfile(result.ok ? result.data : null)
      })
    },
    [memberships]
  )

  const companies = useMemo(
    () => memberships.map((item) => item.company),
    [memberships]
  )

  const activeMembership = useMemo(
    () =>
      memberships.find((item) => item.company_id === activeCompanyId) ?? null,
    [memberships, activeCompanyId]
  )

  const activeCompany: Company | null = activeMembership?.company ?? null
  const isAdmin =
    activeMembership?.role === 'owner' || activeMembership?.role === 'admin'

  const value = useMemo(
    () => ({
      memberships,
      companies,
      activeCompany,
      company: activeCompany,
      activeMembership,
      companyProfile,
      segments,
      loading,
      error,
      isAdmin,
      setActiveCompanyId,
      selectCompany: setActiveCompanyId,
      refresh,
      refreshCompanies: refresh,
    }),
    [
      memberships,
      companies,
      activeCompany,
      activeMembership,
      companyProfile,
      segments,
      loading,
      error,
      isAdmin,
      setActiveCompanyId,
      refresh,
    ]
  )

  return (
    <CompanyContext.Provider value={value}>
      {children ?? <Outlet />}
    </CompanyContext.Provider>
  )
}
