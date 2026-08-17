import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useCompany } from '@/features/company/useCompany'
import { FullPageStatus } from '@/components/ui/FullPageStatus'
import { Button } from '@/components/ui/Button'
import { AppShell } from '@/components/layout/AppShell'
import { OnboardingShell } from '@/components/layout/OnboardingShell'
import {
  clearCompanyOnboardingFlag,
  isCompanyOnboardingInProgress,
} from '@/features/company/onboardingFlag'

const CREATE_PATH = '/app/criar-empresa'
const CREATED_PATH = '/app/empresa-criada'
const ONBOARDING_PATHS = [
  '/app/criar-empresa',
  '/app/empresa-criada',
  '/app/configurar-ambiente',
]

export function AuthenticatedLayout() {
  const { loading, error, companies, refresh } = useCompany()
  const location = useLocation()
  const inWizard = isCompanyOnboardingInProgress()
  const isOnboardingRoute = ONBOARDING_PATHS.includes(location.pathname)
  const createdHint =
    inWizard ||
    Boolean(
      (location.state as { companyCreated?: boolean } | null)?.companyCreated
    )

  useEffect(() => {
    if (!isOnboardingRoute) {
      clearCompanyOnboardingFlag()
    }
  }, [isOnboardingRoute])

  if (loading && companies.length === 0 && !createdHint) {
    return <FullPageStatus title="Carregando..." />
  }

  if (error && companies.length === 0 && !createdHint) {
    return (
      <div className="grid min-h-svh place-items-center bg-paper px-5 text-center">
        <div className="max-w-md">
          <p className="font-display text-xl font-semibold text-ink">
            Não foi possível carregar sua empresa
          </p>
          <p className="mt-2 text-sm text-mist">{error}</p>
          <Button className="mt-6" onClick={() => void refresh()}>
            Tentar de novo
          </Button>
        </div>
      </div>
    )
  }

  if (companies.length === 0) {
    if (createdHint) {
      if (!isOnboardingRoute) {
        return <Navigate to={CREATED_PATH} replace />
      }
      return (
        <OnboardingShell>
          <Outlet />
        </OnboardingShell>
      )
    }

    if (location.pathname !== CREATE_PATH) {
      return <Navigate to={CREATE_PATH} replace />
    }

    return (
      <OnboardingShell>
        <Outlet />
      </OnboardingShell>
    )
  }

  if (location.pathname === CREATE_PATH) {
    return <Navigate to="/app" replace />
  }

  if (isOnboardingRoute) {
    return (
      <OnboardingShell>
        <Outlet />
      </OnboardingShell>
    )
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
