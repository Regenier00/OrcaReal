import { useCallback, useMemo, useState } from 'react'
import type { FeatureId } from '@/content/features'
import { demoFeatureOrder } from '@/content/demoCompany'
import {
  GUEST_LIMITS,
  loadGuestState,
  remainingSimulations,
  saveGuestState,
  type GuestState,
} from '@/features/guest/guestLimits'

export function useGuestSession() {
  const [state, setState] = useState<GuestState>(loadGuestState)

  const markFeatureViewed = useCallback((id: FeatureId) => {
    setState((current) => {
      if (current.featuresViewed.includes(id)) return current
      const next = { ...current, featuresViewed: [...current.featuresViewed, id] }
      saveGuestState(next)
      return next
    })
  }, [])

  const trySimulate = useCallback(() => {
    const current = loadGuestState()
    if (remainingSimulations(current) <= 0) return false
    const next = { ...current, simulationsUsed: current.simulationsUsed + 1 }
    saveGuestState(next)
    setState(next)
    return true
  }, [])

  const remaining = remainingSimulations(state)
  const exploredAll = useMemo(
    () => demoFeatureOrder.every((id) => state.featuresViewed.includes(id)),
    [state.featuresViewed]
  )

  return {
    simulationsUsed: state.simulationsUsed,
    simulationsRemaining: remaining,
    maxSimulations: GUEST_LIMITS.maxSimulations,
    exploredAll,
    markFeatureViewed,
    trySimulate,
  }
}
