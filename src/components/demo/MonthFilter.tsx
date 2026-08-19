import { demoMonths, type MonthKey } from '@/content/demoCompany'
import { cn } from '@/lib/utils'

interface MonthFilterProps {
  value: MonthKey
  onChange: (value: MonthKey) => void
}

export function MonthFilter({ value, onChange }: MonthFilterProps) {
  const options: Array<{ key: MonthKey; label: string }> = [
    { key: 'ytd', label: 'Ano até jun' },
    ...demoMonths.map((month) => ({ key: month.key as MonthKey, label: month.label })),
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
              ? 'border-brand bg-brand text-white'
              : 'border-paper-muted bg-white text-ink-soft/70 hover:border-brand/30'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
