import { useMemo, useState } from 'react'
import { demoLines, groupCosts, type DemoGate, type MonthKey } from '@/content/demoCompany'
import { formatBRL, formatPct } from '@/lib/money'
import { MonthFilter } from '@/components/demo/MonthFilter'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface CostAnalysisPanelProps {
  month: MonthKey
  onMonthChange: (month: MonthKey) => void
  onGate: (gate: DemoGate) => void
}

export function CostAnalysisPanel({
  month,
  onMonthChange,
  onGate,
}: CostAnalysisPanelProps) {
  const [by, setBy] = useState<'category' | 'department'>('category')
  const rows = useMemo(() => groupCosts(demoLines, month, by), [month, by])
  const topShare = rows.slice(0, 2).reduce((total, row) => total + row.share, 0)

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">Análise de Custos</h2>
          <p className="mt-1 max-w-xl text-sm text-ink-soft/70">
            Os poucos itens que concentram o gasto aparecem primeiro. Nesta empresa de
            exemplo, pessoal e operação puxam o resultado.
          </p>
        </div>
        <MonthFilter value={month} onChange={onMonthChange} />
      </div>

      <div className="mt-5 flex gap-1.5">
        <Toggle
          active={by === 'category'}
          onClick={() => setBy('category')}
          label="Por categoria"
        />
        <Toggle
          active={by === 'department'}
          onClick={() => setBy('department')}
          label="Por departamento"
        />
      </div>

      <p className="mt-4 text-sm text-ink-soft/70">
        Os dois maiores grupos concentram{' '}
        <span className="font-semibold text-ink">{formatPct(topShare)}</span> do realizado.
      </p>

      <ul className="mt-5 flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.label} className="rounded-2xl border border-paper-muted bg-white p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-medium text-ink">{row.label}</p>
              <p className="tabular-nums text-sm text-ink">{formatBRL(row.actual)}</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper-muted">
              <div
                className="h-full rounded-full bg-ink/70"
                style={{ width: `${Math.max(4, row.share * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-mist">
              {formatPct(row.share)} do total · acumulado {formatPct(row.cumulative)}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-5">
        <Button variant="secondary" onClick={() => onGate('export')}>
          Exportar ranking
        </Button>
      </div>
    </div>
  )
}

function Toggle({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition',
        active
          ? 'border-brand bg-brand text-white'
          : 'border-paper-muted bg-white text-ink-soft/70 hover:border-brand/30'
      )}
    >
      {label}
    </button>
  )
}
