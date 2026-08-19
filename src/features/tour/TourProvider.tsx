import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useCompany } from '@/features/company/useCompany'
import { TourContext } from '@/features/tour/tour-context'
import {
  PAGE_TOUR_CLOSE_LABEL,
  PAGE_TOUR_DONE_LABEL,
  pageTourStepIndices,
  pageTourStaysOnPath,
  TOUR_SKIP_LABEL,
  TOUR_STEPS,
} from '@/features/tour/steps'
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
  const [pageMode, setPageMode] = useState(false)
  const [bound, setBound] = useState<{ start: number; end: number } | null>(null)
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
    setPageMode(false)
    setBound(null)
    setIndex(0)
  }

  if (shouldKickOff && !started && !pageMode && dismissedCompanyId !== companyId) {
    setStarted(true)
  }

  const firstIndex = bound?.start ?? 0
  const lastIndex = bound?.end ?? TOUR_STEPS.length - 1
  const step = TOUR_STEPS[index] ?? TOUR_STEPS[0]
  const isLast = index >= lastIndex
  const active =
    Boolean(companyId) &&
    (pageMode || dismissedCompanyId !== companyId) &&
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
    setPageMode(false)
    setBound(null)
    setStarted(true)
    setIndex(0)
    navigate('/app', { state: { startTour: true } })
  }, [companyId, navigate])

  const startPage = useCallback(
    (pathname = location.pathname) => {
      if (!companyId) return
      const indices = pageTourStepIndices(pathname)
      if (indices.length === 0) return
      const startIndex = indices[0]
      const endIndex = indices[indices.length - 1]
      if (startIndex == null || endIndex == null) return
      setPageMode(true)
      setBound({ start: startIndex, end: endIndex })
      setStarted(true)
      setIndex(startIndex)
      const next = TOUR_STEPS[startIndex]
      if (next && location.pathname !== next.path && !pageTourStaysOnPath(pathname)) {
        navigate(next.path)
      }
    },
    [companyId, location.pathname, navigate]
  )

  const skip = useCallback(() => {
    if (pageMode) {
      setPageMode(false)
      setBound(null)
      setStarted(false)
      setIndex(0)
      return
    }
    if (companyId) skipTour(companyId)
    setDismissedCompanyId(companyId)
    setStarted(false)
    setIndex(0)
    clearStartFlag()
  }, [clearStartFlag, companyId, pageMode])

  const complete = useCallback(() => {
    if (pageMode) {
      setPageMode(false)
      setBound(null)
      setStarted(false)
      setIndex(0)
      return
    }
    if (companyId) completeTour(companyId)
    setDismissedCompanyId(companyId)
    setStarted(false)
    setIndex(0)
    clearStartFlag()
    if (location.pathname !== '/app') navigate('/app')
  }, [clearStartFlag, companyId, location.pathname, navigate, pageMode])

  const goNext = useCallback(() => {
    if (index >= lastIndex) {
      complete()
      return
    }
    goToStep(index + 1)
  }, [complete, goToStep, index, lastIndex])

  const goBack = useCallback(() => {
    if (index <= firstIndex) return
    goToStep(index - 1)
  }, [firstIndex, goToStep, index])

  const value = useMemo(
    () => ({
      active,
      index,
      step,
      pageMode,
      stepNumber: index - firstIndex + 1,
      stepCount: lastIndex - firstIndex + 1,
      isLast,
      nextLabel: isLast && pageMode ? PAGE_TOUR_DONE_LABEL : step.nextLabel,
      skipLabel: pageMode ? PAGE_TOUR_CLOSE_LABEL : TOUR_SKIP_LABEL,
      start,
      startPage,
      skip,
      complete,
      goNext,
      goBack,
    }),
    [
      active,
      complete,
      firstIndex,
      goBack,
      goNext,
      index,
      isLast,
      lastIndex,
      pageMode,
      skip,
      start,
      startPage,
      step,
    ]
  )

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>
}
