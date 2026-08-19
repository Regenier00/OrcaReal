import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useCompany } from '@/features/company/useCompany'
import { TourContext } from '@/features/tour/tour-context'
import {
  completeTour,
  reopenTour,
  shouldAutoStartTour,
  skipTour,
} from '@/features/tour/storage'

export function TourProvider({ children }: { children: ReactNode }) {
  const { activeCompany } = useCompany()
  const location = useLocation()
  const navigate = useNavigate()
  const [dismissedCompanyId, setDismissedCompanyId] = useState<string | null>(null)
  const companyId = activeCompany?.id ?? ''
  const startTourFlag = Boolean(
    (location.state as { startTour?: boolean } | null)?.startTour
  )

  const active =
    Boolean(companyId) &&
    location.pathname === '/app' &&
    dismissedCompanyId !== companyId &&
    (startTourFlag || shouldAutoStartTour(companyId))

  const clearStartFlag = useCallback(() => {
    if (!startTourFlag) return
    navigate('/app', { replace: true, state: {} })
  }, [navigate, startTourFlag])

  const start = useCallback(() => {
    if (!companyId) return
    reopenTour(companyId)
    setDismissedCompanyId(null)
    if (location.pathname === '/app') return
    navigate('/app', { state: { startTour: true } })
  }, [companyId, location.pathname, navigate])

  const skip = useCallback(() => {
    if (companyId) skipTour(companyId)
    setDismissedCompanyId(companyId)
    clearStartFlag()
  }, [clearStartFlag, companyId])

  const complete = useCallback(() => {
    if (companyId) completeTour(companyId)
    setDismissedCompanyId(companyId)
    clearStartFlag()
  }, [clearStartFlag, companyId])

  const value = useMemo(
    () => ({ active, start, skip, complete }),
    [active, start, skip, complete]
  )

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>
}
