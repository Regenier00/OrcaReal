import { cn } from '@/lib/utils'
import type { BudgetMonth } from '@/features/budget/period'
import type { ComparisonMonthKey } from '@/features/comparison/model'

interface PeriodFilterProps {
  months: BudgetMonth[]
  value: ComparisonMonthKey
  onChange: (value: ComparisonMonthKey) => void
}

export function PeriodFilter({ months, value, onChange }: PeriodFilterProps) {
  const options: Array<{ key: ComparisonMonthKey; label: string }> = [
    { key: 'all', label: 'Período completo' },
    ...months.map((month) => ({
      key: month.key,
      label: month.label,
    })),
  ]

  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Período">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition',
            value === option.key
              ? 'border-ink/30 bg-ink text-paper'
              : 'border-paper-muted bg-white text-ink-soft/70 hover:border-ink/20'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
