import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useCompany } from '@/features/company/useCompany'
import { TourContext } from '@/features/tour/tour-context'
import { TOUR_STEPS } from '@/features/tour/steps'
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
  const companyId = activeCompany?.id ?? ''
  const [dismissedCompanyId, setDismissedCompanyId] = useState<string | null>(null)
  const [started, setStarted] = useState(false)
  const [index, setIndex] = useState(0)
  const [seenCompanyId, setSeenCompanyId] = useState(companyId)
  const startTourFlag = Boolean(
    (location.state as { startTour?: boolean } | null)?.startTour
  )
  const shouldKickOff =
    location.pathname === '/app' &&
    (startTourFlag || shouldAutoStartTour(companyId))

  if (companyId !== seenCompanyId) {
    setSeenCompanyId(companyId)
    setStarted(false)
    setIndex(0)
  }

  if (shouldKickOff && !started && dismissedCompanyId !== companyId) {
    setStarted(true)
  }

  const step = TOUR_STEPS[index] ?? TOUR_STEPS[0]
  const active =
    Boolean(companyId) &&
    dismissedCompanyId !== companyId &&
    location.pathname.startsWith('/app') &&
    (started || shouldKickOff)

  const clearStartFlag = useCallback(() => {
    if (!startTourFlag) return
    navigate(location.pathname, { replace: true, state: {} })
  }, [location.pathname, navigate, startTourFlag])

  const goToStep = useCallback(
    (nextIndex: number) => {
      const next = TOUR_STEPS[nextIndex]
      if (!next) return
      setIndex(nextIndex)
      if (location.pathname !== next.path) {
        navigate(next.path)
      }
    },
    [location.pathname, navigate]
  )

  const start = useCallback(() => {
    if (!companyId) return
    reopenTour(companyId)
    setDismissedCompanyId(null)
    setStarted(true)
    setIndex(0)
    navigate('/app', { state: { startTour: true } })
  }, [companyId, navigate])

  const skip = useCallback(() => {
    if (companyId) skipTour(companyId)
    setDismissedCompanyId(companyId)
    setStarted(false)
    setIndex(0)
    clearStartFlag()
  }, [clearStartFlag, companyId])

  const complete = useCallback(() => {
    if (companyId) completeTour(companyId)
    setDismissedCompanyId(companyId)
    setStarted(false)
    setIndex(0)
    clearStartFlag()
    if (location.pathname !== '/app') navigate('/app')
  }, [clearStartFlag, companyId, location.pathname, navigate])

  const goNext = useCallback(() => {
    if (index >= TOUR_STEPS.length - 1) {
      complete()
      return
    }
    goToStep(index + 1)
  }, [complete, goToStep, index])

  const goBack = useCallback(() => {
    if (index <= 0) return
    goToStep(index - 1)
  }, [goToStep, index])

  const value = useMemo(
    () => ({
      active,
      index,
      step,
      start,
      skip,
      complete,
      goNext,
      goBack,
    }),
    [active, complete, goBack, goNext, index, skip, start, step]
  )

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>
}
