import { type ReactNode } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'
import { useCompany } from '@/features/company/useCompany'
import { CompanySwitcher } from '@/components/company/CompanySwitcher'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const links = [
  { to: '/app', label: 'Início', end: true },
  { to: '/app/orcamentos', label: 'Orçamentos' },
  { to: '/app/realizado', label: 'Realizado' },
  { to: '/app/orcado-realizado', label: 'Orçado × Realizado' },
  { to: '/app/indicadores', label: 'Indicadores' },
  { to: '/app/empresa', label: 'Empresa' },
  { to: '/app/perfil', label: 'Perfil' },
]

export function AppShell({ children }: { children?: ReactNode }) {
  const { signOut, user } = useAuth()
  const { activeCompany } = useCompany()

  return (
    <div className="min-h-svh bg-paper">
      <header className="border-b border-paper-muted bg-ink text-paper">
        <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <Link to="/app" className="font-display text-xl font-bold tracking-tight">
              <span className="text-white">Orca</span>
              <span className="text-sky">Real</span>
            </Link>
            {activeCompany ? (
              <p className="mt-1 truncate text-xs text-white/55">
                Empresa: {activeCompany.trade_name || activeCompany.name}
              </p>
            ) : null}
          </div>

          <nav className="hidden items-center gap-1 sm:flex">
            {links.map((link) => (
              <NavItem key={link.to} {...link} />
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <CompanySwitcher />
            <span className="hidden max-w-40 truncate text-xs text-white/55 xl:inline">
              {user?.email}
            </span>
            <Button variant="ghost" className="!py-2 !text-xs" onClick={() => void signOut()}>
              Sair
            </Button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-[90rem] gap-1 overflow-x-auto px-5 pb-3 sm:hidden">
          {links.map((link) => (
            <NavItem key={link.to} {...link} />
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[90rem] px-5 py-8">{children ?? <Outlet />}</main>
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
          'whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition',
          isActive
            ? 'bg-white/10 text-white'
            : 'text-white/65 hover:bg-white/5 hover:text-white'
        )
      }
    >
      {label}
    </NavLink>
  )
}
