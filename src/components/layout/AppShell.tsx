import { type ReactNode } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'
import { useCompany } from '@/features/company/useCompany'
import { CompanySwitcher } from '@/components/company/CompanySwitcher'
import { CompanyLogoAvatar } from '@/components/company/CompanyLogoAvatar'
import { Button } from '@/components/ui/Button'
import { PageTourButton } from '@/components/tour/PageTourButton'
import { PlatformTour } from '@/components/tour/PlatformTour'
import { TourProvider } from '@/features/tour/TourProvider'
import { useTour } from '@/features/tour/useTour'
import { cn } from '@/lib/utils'

const links = [
  { to: '/app', label: 'Dashboard', end: true },
  { to: '/app/orcamentos', label: 'Orçamentos' },
  { to: '/app/realizado', label: 'Realizado' },
  { to: '/app/orcado-realizado', label: 'Orçado × Realizado' },
  { to: '/app/indicadores', label: 'Indicadores' },
  { to: '/app/empresa', label: 'Empresa' },
  { to: '/app/perfil', label: 'Perfil' },
]

export function AppShell({ children }: { children?: ReactNode }) {
  return (
    <TourProvider>
      <AppShellFrame>{children}</AppShellFrame>
    </TourProvider>
  )
}

function AppShellFrame({ children }: { children?: ReactNode }) {
  const { signOut, user } = useAuth()
  const { activeCompany } = useCompany()
  const { active: tourActive } = useTour()

  return (
    <div className="min-h-svh bg-paper">
      <header className="border-b border-paper-muted bg-white">
        <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-4 px-5 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/app" className="font-display text-lg font-bold tracking-tight">
              <span className="text-ink">Orca</span>
              <span className="text-brand">Real</span>
            </Link>
            {activeCompany ? (
              <div className="hidden min-w-0 items-center gap-2 sm:flex">
                <CompanyLogoAvatar
                  name={activeCompany.trade_name || activeCompany.name}
                  logoUrl={activeCompany.logo_url}
                  size="sm"
                />
                <p className="truncate text-xs text-mist">
                  {activeCompany.trade_name || activeCompany.name}
                </p>
              </div>
            ) : null}
          </div>

          <nav data-tour="nav" className="hidden items-center gap-1 sm:flex">
            {links.map((link) => (
              <NavItem key={link.to} {...link} />
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <CompanySwitcher />
            <span className="hidden max-w-40 truncate text-xs text-mist xl:inline">
              {user?.email}
            </span>
            <Button variant="quiet" className="!py-2 !text-xs" onClick={() => void signOut()}>
              Sair
            </Button>
          </div>
        </div>

        <nav
          data-tour="nav"
          className="mx-auto flex max-w-[90rem] gap-1 overflow-x-auto px-5 pb-2 sm:hidden"
        >
          {links.map((link) => (
            <NavItem key={link.to} {...link} />
          ))}
        </nav>
      </header>

      <main
        className={cn('mx-auto max-w-[90rem] px-5 py-8', tourActive && 'pb-56')}
      >
        {children ?? <Outlet />}
        <PageTourButton />
      </main>
      <PlatformTour />
    </div>
  )
}

function NavItem({
  to,
  label,
  end,
}: {
  to: string
  label: string
  end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition',
          isActive
            ? 'bg-brand-soft text-brand'
            : 'text-mist hover:bg-paper hover:text-ink'
        )
      }
    >
      {label}
    </NavLink>
  )
}
