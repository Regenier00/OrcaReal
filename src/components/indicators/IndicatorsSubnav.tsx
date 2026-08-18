import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const items = [
  { to: '/app/indicadores', label: 'Indicadores operacionais', end: true },
  { to: '/app/indicadores/personalizados', label: 'Indicadores personalizados' },
]

export function IndicatorsSubnav() {
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
                : 'text-ink-soft hover:bg-paper hover:text-ink'
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
