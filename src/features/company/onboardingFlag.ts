const FLAG_KEY = 'orcareal.creatingCompany'
const LOCATION_KEY = 'orcareal.companyLocation'

export function markCompanyOnboardingInProgress() {
  try {
    sessionStorage.setItem(FLAG_KEY, '1')
  } catch {
    // storage pode estar bloqueado
  }
}

export function isCompanyOnboardingInProgress() {
  try {
    return sessionStorage.getItem(FLAG_KEY) === '1'
  } catch {
    return false
  }
}

export function clearCompanyOnboardingFlag() {
  try {
    sessionStorage.removeItem(FLAG_KEY)
  } catch {
    // storage pode estar bloqueado
  }
}

export function storeCompanyLocation(input: { state?: string; city?: string }) {
  try {
    sessionStorage.setItem(
      LOCATION_KEY,
      JSON.stringify({
        state: input.state ?? '',
        city: input.city ?? '',
      })
    )
  } catch {
    // storage pode estar bloqueado
  }
}

export function readStoredCompanyLocation(): { state: string; city: string } {
  try {
    const raw = sessionStorage.getItem(LOCATION_KEY)
    if (!raw) return { state: '', city: '' }
    const parsed = JSON.parse(raw) as { state?: string; city?: string }
    return { state: parsed.state ?? '', city: parsed.city ?? '' }
  } catch {
    return { state: '', city: '' }
  }
}
