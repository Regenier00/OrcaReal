import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/Input'
import type { ExperienceQuestion, QuestionOption } from '@/features/experience/types'

export function QuestionCard({
  question,
  options,
  value,
  onChange,
}: {
  question: ExperienceQuestion
  options: QuestionOption[]
  value: string | number | string[] | null
  onChange: (value: string | number | string[]) => void
}) {
  if (question.answerType === 'text') {
    return (
      <Input
        value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Escreva com suas palavras"
      />
    )
  }

  if (question.answerType === 'number') {
    return (
      <Input
        type="number"
        inputMode="decimal"
        value={typeof value === 'number' || typeof value === 'string' ? String(value) : ''}
        onChange={(event) => {
          const next = event.target.value
          onChange(next === '' ? '' : Number(next))
        }}
        placeholder="Informe um número"
      />
    )
  }

  if (question.answerType === 'multiple') {
    const selected = Array.isArray(value) ? value : value ? [String(value)] : []
    const layout = question.optionLayout === 'cards' ? 'cards' : 'chips'
    if (layout === 'cards') {
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {options.map((option) => {
            const active = selected.includes(option.value)
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(
                    active
                      ? selected.filter((item) => item !== option.value)
                      : [...selected, option.value]
                  )
                }}
                className={cn(
                  'rounded-xl border px-3 py-3 text-left text-sm leading-snug transition',
                  active
                    ? 'border-brand bg-brand text-white shadow-card'
                    : 'border-paper-muted bg-white text-ink-soft hover:border-brand'
                )}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      )
    }
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option.value)
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(
                  active
                    ? selected.filter((item) => item !== option.value)
                    : [...selected, option.value]
                )
              }}
              className={chipClass(active)}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    )
  }

  const current = Array.isArray(value) ? value[0] : value
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={chipClass(String(current) === option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function chipClass(active: boolean) {
  return cn(
    'rounded-full border px-4 py-2 text-sm transition',
    active
      ? 'border-brand bg-brand text-white'
      : 'border-paper-muted bg-white text-ink-soft hover:border-brand'
  )
}
