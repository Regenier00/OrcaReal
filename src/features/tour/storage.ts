const PREFIX = 'orcareal.platformTour.'

export type TourStatus = 'pending' | 'completed' | 'skipped'

export const SKIP_TOUR_LABEL = 'Já sei usar a plataforma'

export function tourStorageKey(companyId: string) {
  return `${PREFIX}${companyId}`
}

export function getTourStatus(companyId: string): TourStatus | null {
  if (!companyId) return null
  try {
    const raw = localStorage.getItem(tourStorageKey(companyId))
    if (raw === 'pending' || raw === 'completed' || raw === 'skipped') return raw
    return null
  } catch {
    return null
  }
}

function writeStatus(companyId: string, status: TourStatus) {
  if (!companyId) return
  try {
    localStorage.setItem(tourStorageKey(companyId), status)
  } catch {
    // storage pode estar bloqueado
  }
}

export function markTourPending(companyId: string) {
  const current = getTourStatus(companyId)
  if (current === 'completed' || current === 'skipped') return
  writeStatus(companyId, 'pending')
}

export function shouldAutoStartTour(companyId: string) {
  return getTourStatus(companyId) === 'pending'
}

export function completeTour(companyId: string) {
  writeStatus(companyId, 'completed')
}

export function skipTour(companyId: string) {
  writeStatus(companyId, 'skipped')
}

export function reopenTour(companyId: string) {
  writeStatus(companyId, 'pending')
}
