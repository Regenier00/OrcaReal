import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { ACTUAL_PATHS } from '@/features/actual/model'

const items = [
  { to: ACTUAL_PATHS.root, label: 'Visão geral', end: true },
  { to: ACTUAL_PATHS.import, label: 'Importar extrato' },
  { to: ACTUAL_PATHS.unappropriated, label: 'Não apropriados' },
]

export function ActualSubnav() {
  return (
    <nav className="mt-6 flex gap-1 overflow-x-auto rounded-xl bg-white p-1 ring-1 ring-paper-muted">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              'whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition',
              isActive
                ? 'bg-navy text-paper'
                : 'text-ink-soft hover:bg-paper hover:text-ink',
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
