import { formatMoney } from '@/features/budget/money'
import { formatSignedPct } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { ComparisonSummary } from '@/features/comparison/model'

export function ComparisonStats({ summary }: { summary: ComparisonSummary }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      <Stat label="Orçado" value={formatMoney(summary.budget)} />
      <Stat label="Realizado" value={formatMoney(summary.actual)} />
      <Stat
        label="Desvio"
        value={`${formatMoney(summary.variance)} (${formatSignedPct(summary.variancePct)})`}
        tone={summary.variance > 0 ? 'danger' : 'ok'}
      />
    </dl>
  )
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'ok' | 'danger'
}) {
  return (
    <div className="rounded-2xl border border-paper-muted bg-white px-4 py-4">
      <dt className="text-[11px] uppercase tracking-wide text-mist">{label}</dt>
      <dd
        className={cn(
          'mt-1 font-display text-xl font-semibold',
          tone === 'danger'
            ? 'text-danger'
            : tone === 'ok'
              ? 'text-ok'
              : 'text-ink'
        )}
      >
        {value}
      </dd>
    </div>
  )
}
