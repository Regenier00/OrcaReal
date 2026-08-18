import { formatMoney } from '@/features/budget/money'
import { formatSignedPct } from '@/lib/money'
import { cn } from '@/lib/utils'
import { moneySideCardClass } from '@/components/indicators/moneySideStyle'
import type { ComparisonSummary } from '@/features/comparison/model'
import type { MoneySide } from '@/features/indicators/formula'

export function ComparisonStats({ summary }: { summary: ComparisonSummary }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      <Stat label="Orçado" value={formatMoney(summary.budget)} surface="cost" />
      <Stat label="Realizado" value={formatMoney(summary.actual)} surface="cost" />
      <Stat
        label="Desvio"
        value={`${formatMoney(summary.variance)} (${formatSignedPct(summary.variancePct)})`}
        tone={summary.variance > 0 ? 'danger' : 'ok'}
        surface="cost"
      />
    </dl>
  )
}

function Stat({
  label,
  value,
  tone = 'default',
  surface = null,
}: {
  label: string
  value: string
  tone?: 'default' | 'ok' | 'danger'
  surface?: MoneySide | null
}) {
  return (
    <div className={cn('rounded-2xl border px-4 py-4', moneySideCardClass(surface))}>
      <dt className="text-[11px] uppercase tracking-wide text-mist">{label}</dt>
      <dd
        className={cn(
          'mt-1 font-numeric text-xl font-semibold',
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
