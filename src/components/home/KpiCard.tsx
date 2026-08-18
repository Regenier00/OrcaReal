import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { ChangeBadge } from '@/components/home/ChangeBadge'
import { moneySideCardClass } from '@/components/indicators/moneySideStyle'

export function KpiCard({
  kicker,
  title,
  value,
  hint,
  change,
  invertChange,
  icon,
  tone = 'navy',
  surface = 'default',
  to,
}: {
  kicker: string
  title: string
  value: string
  hint?: string
  change?: number | null
  invertChange?: boolean
  icon: ReactNode
  tone?: 'navy' | 'ok' | 'danger' | 'warn'
  surface?: 'default' | 'revenue' | 'cost'
  to?: string
}) {
  const className = cn(
    'flex h-full flex-col rounded-2xl border p-5 shadow-card transition',
    moneySideCardClass(surface === 'default' ? null : surface, Boolean(to))
  )

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            tone === 'ok' && 'bg-ok-soft text-ok',
            tone === 'danger' && 'bg-danger-soft text-danger',
            tone === 'warn' && 'bg-warn-soft text-warn',
            tone === 'navy' && 'bg-navy-soft text-navy'
          )}
        >
          {icon}
        </span>
        <ChangeBadge value={change} invert={invertChange} />
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-mist">
        {kicker}
      </p>
      <p className="mt-1 font-display text-sm font-medium text-navy/80">{title}</p>
      <p className="mt-3 font-numeric text-2xl font-semibold tracking-tight text-navy sm:text-[1.7rem]">
        {value}
      </p>
      {hint ? <p className="mt-2 text-sm leading-relaxed text-mist">{hint}</p> : null}
    </>
  )

  if (to) {
    return (
      <Link to={to} className={className}>
        {body}
      </Link>
    )
  }

  return <div className={className}>{body}</div>
}
