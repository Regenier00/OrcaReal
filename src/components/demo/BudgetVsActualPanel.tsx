import { useMemo } from 'react'
import {
  demoLines,
  sliceByMonth,
  totals,
  type MonthKey,
} from '@/content/demoCompany'
import { formatBRL, formatSignedPct } from '@/lib/money'
import { MonthFilter } from '@/components/demo/MonthFilter'
import { VarianceTable } from '@/components/demo/VarianceTable'
import { Button } from '@/components/ui/Button'
import { moneySideCardClass } from '@/components/indicators/moneySideStyle'
import { cn } from '@/lib/utils'
import type { DemoGate } from '@/content/demoCompany'
import type { MoneySide } from '@/features/indicators/formula'

interface BudgetVsActualPanelProps {
  month: MonthKey
  onMonthChange: (month: MonthKey) => void
  onGate: (gate: DemoGate) => void
}

export function BudgetVsActualPanel({
  month,
  onMonthChange,
  onGate,
}: BudgetVsActualPanelProps) {
  const summary = useMemo(() => totals(demoLines, month), [month])
  const rows = useMemo(
    () =>
      demoLines.map((line) => ({
        label: `${line.department} · ${line.category}`,
        detail: line.costCenter,
        budget: sliceByMonth(line.budget, month),
        actual: sliceByMonth(line.actual, month),
      })),
    [month]
  )

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">Orçado × Realizado</h2>
          <p className="mt-1 max-w-xl text-sm text-ink-soft/70">
            O desvio aparece no mesmo recorte — período, departamento e centro de custo —
            sem montar uma aba nova.
          </p>
        </div>
        <MonthFilter value={month} onChange={onMonthChange} />
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Orçado" value={formatBRL(summary.budget)} surface="cost" />
        <Stat label="Realizado" value={formatBRL(summary.actual)} surface="cost" />
        <Stat
          label="Desvio"
          value={`${formatBRL(summary.variance)} (${formatSignedPct(summary.variancePct)})`}
          tone={summary.variance > 0 ? 'danger' : 'ok'}
          surface="cost"
        />
      </dl>

      <VarianceTable className="mt-6" rows={rows} />

      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => onGate('export')}>
          Exportar Excel / PDF
        </Button>
        <Button variant="secondary" onClick={() => onGate('save')}>
          Salvar este recorte
        </Button>
      </div>
    </div>
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
        className={
          tone === 'danger'
            ? 'mt-1 font-numeric text-xl font-semibold text-danger'
            : tone === 'ok'
              ? 'mt-1 font-numeric text-xl font-semibold text-ok'
              : 'mt-1 font-numeric text-xl font-semibold text-ink'
        }
      >
        {value}
      </dd>
    </div>
  )
}
