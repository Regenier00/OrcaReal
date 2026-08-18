import { formatSignedPct } from '@/lib/money'
import { cn } from '@/lib/utils'
import { TrendDownIcon, TrendUpIcon } from '@/components/home/DashboardIcons'

export function ChangeBadge({
  value,
  invert = false,
  label = 'vs mês anterior',
}: {
  value: number | null | undefined
  invert?: boolean
  label?: string
}) {
  if (value == null || !Number.isFinite(value)) {
    return <span className="text-xs text-mist">Sem base de comparação</span>
  }

  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-mist">
        0,0% {label}
      </span>
    )
  }

  const up = value > 0
  const positive = invert ? !up : up

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-semibold',
        positive ? 'text-ok' : 'text-danger'
      )}
    >
      {up ? <TrendUpIcon className="h-3.5 w-3.5" /> : <TrendDownIcon className="h-3.5 w-3.5" />}
      {formatSignedPct(value)} {label}
    </span>
  )
}
