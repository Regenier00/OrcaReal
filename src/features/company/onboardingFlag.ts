const FLAG_KEY = 'orcareal.creatingCompany'

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
