const STORAGE_KEY = 'orcareal.guest.v1'

export const GUEST_LIMITS = {
  maxSimulations: 2,
} as const

export interface GuestState {
  simulationsUsed: number
  featuresViewed: string[]
}

const emptyState: GuestState = {
  simulationsUsed: 0,
  featuresViewed: [],
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function loadGuestState(): GuestState {
  if (!canUseStorage()) return emptyState

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState
    const parsed = JSON.parse(raw) as Partial<GuestState>
    return {
      simulationsUsed: Math.min(
        GUEST_LIMITS.maxSimulations,
        Math.max(0, Number(parsed.simulationsUsed) || 0)
      ),
      featuresViewed: Array.isArray(parsed.featuresViewed)
        ? parsed.featuresViewed.filter((item) => typeof item === 'string')
        : [],
    }
  } catch {
    return emptyState
  }
}

export function saveGuestState(state: GuestState) {
  if (!canUseStorage()) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function remainingSimulations(state: GuestState) {
  return Math.max(0, GUEST_LIMITS.maxSimulations - state.simulationsUsed)
}
