import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'
import { CompanyProvider } from '@/features/company/CompanyProvider'
import { CompanySwitcher } from '@/components/company/CompanySwitcher'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const links = [
  { to: '/app', label: 'Início', end: true },
  { to: '/app/orcamentos', label: 'Orçamentos' },
  { to: '/app/empresa', label: 'Empresa' },
  { to: '/app/perfil', label: 'Perfil' },
]

export function AppShell() {
  const { signOut, user } = useAuth()

  return (
    <CompanyProvider>
      <div className="min-h-svh bg-paper">
        <header className="border-b border-paper-muted bg-ink text-paper">
          <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-4 px-5 py-4">
            <Link to="/app" className="font-display text-xl font-bold tracking-tight">
              <span className="text-white">Orca</span>
              <span className="text-sky">Real</span>
            </Link>

            <nav className="hidden items-center gap-1 sm:flex">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    cn(
                      'rounded-lg px-3 py-2 text-sm font-medium transition',
                      isActive
                        ? 'bg-white/10 text-white'
                        : 'text-white/65 hover:bg-white/5 hover:text-white'
                    )
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <CompanySwitcher />
              <span className="hidden text-xs text-white/55 xl:inline">
                {user?.email}
              </span>
              <Button variant="ghost" className="!py-2 !text-xs" onClick={() => void signOut()}>
                Sair
              </Button>
            </div>
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-paper-muted bg-ink px-5 py-2 sm:hidden">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cn(
                  'whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium',
                  isActive ? 'bg-white/10 text-white' : 'text-white/65'
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <main className="mx-auto max-w-[90rem] px-5 py-8">
          <Outlet />
        </main>
      </div>
    </CompanyProvider>
  )
}
