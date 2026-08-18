import { Link } from 'react-router-dom'
import type { FinancialInsight, InsightTone } from '@/features/home/dashboardModel'
import { SectionHeading } from '@/components/home/FinancialSummary'
import {
  AlertIcon,
  CheckIcon,
  InfoIcon,
} from '@/components/home/DashboardIcons'
import { cn } from '@/lib/utils'

const toneStyles: Record<
  InsightTone,
  { card: string; icon: string; Icon: typeof CheckIcon }
> = {
  ok: {
    card: 'border-ok/15 bg-ok-soft/60',
    icon: 'bg-ok-soft text-ok',
    Icon: CheckIcon,
  },
  danger: {
    card: 'border-danger/15 bg-danger-soft/70',
    icon: 'bg-danger-soft text-danger',
    Icon: AlertIcon,
  },
  warn: {
    card: 'border-warn/20 bg-warn-soft/80',
    icon: 'bg-warn-soft text-warn',
    Icon: AlertIcon,
  },
  info: {
    card: 'border-paper-muted bg-white',
    icon: 'bg-navy-soft text-navy',
    Icon: InfoIcon,
  },
}

export function FinancialInsights({ insights }: { insights: FinancialInsight[] }) {
  if (insights.length === 0) return null

  return (
    <section className="rounded-2xl border border-paper-muted bg-white p-5 shadow-card sm:p-6">
      <SectionHeading
        kicker="Insights"
        title="Leitura do desempenho"
        subtitle="Mensagens contextuais com base no mês em foco."
      />
      <ul className="mt-4 space-y-3">
        {insights.map((insight) => {
          const style = toneStyles[insight.tone]
          const Icon = style.Icon
          const body = (
            <div className="flex gap-3">
              <span
                className={cn(
                  'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                  style.icon
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-sm font-semibold text-navy">
                  {insight.title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft/75">
                  {insight.message}
                </p>
              </div>
            </div>
          )

          return (
            <li key={insight.id}>
              {insight.href ? (
                <Link
                  to={insight.href}
                  className={cn(
                    'block rounded-xl border px-4 py-3 transition hover:border-navy/20',
                    style.card
                  )}
                >
                  {body}
                </Link>
              ) : (
                <div className={cn('rounded-xl border px-4 py-3', style.card)}>
                  {body}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
