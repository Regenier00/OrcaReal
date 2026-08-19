import { cn } from '@/lib/utils'
import type { BudgetMonth } from '@/features/budget/period'
import type { ComparisonMonthKey } from '@/features/comparison/model'
import { defaultUnitCostMonth } from '@/features/experience/unitCost'

interface IndicatorPeriodFilterProps {
  months: BudgetMonth[]
  value: ComparisonMonthKey
  onChange: (value: ComparisonMonthKey) => void
}

type IndicatorViewMode = 'consolidated' | 'monthly'

const VIEW_MODES: Array<{ id: IndicatorViewMode; label: string }> = [
  { id: 'consolidated', label: 'Consolidados' },
  { id: 'monthly', label: 'Mensais' },
]

export function IndicatorPeriodFilter({
  months,
  value,
  onChange,
}: IndicatorPeriodFilterProps) {
  const isConsolidated = value === 'all'
  const viewMode: IndicatorViewMode = isConsolidated ? 'consolidated' : 'monthly'

  const selectViewMode = (mode: IndicatorViewMode) => {
    if (mode === 'consolidated') {
      onChange('all')
      return
    }
    if (value !== 'all') return
    onChange(defaultUnitCostMonth(months) ?? months[months.length - 1]?.key ?? 'all')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-navy-bright">
          Visualização
        </p>
        <div
          className="inline-flex rounded-full border border-paper-muted bg-white p-0.5"
          role="group"
          aria-label="Visualização dos indicadores"
        >
          {VIEW_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => selectViewMode(mode.id)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
                viewMode === mode.id
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-ink-soft/70 hover:text-ink'
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'monthly' && months.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Mês">
          {months.map((month) => (
            <button
              key={month.key}
              type="button"
              onClick={() => onChange(month.key)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition',
                value === month.key
                  ? 'border-brand bg-brand text-white'
                  : 'border-paper-muted bg-white text-ink-soft/70 hover:border-brand/30'
              )}
            >
              {month.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
