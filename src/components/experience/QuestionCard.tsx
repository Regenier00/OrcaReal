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
      ? 'border-navy bg-navy text-paper'
      : 'border-paper-muted bg-white text-ink-soft hover:border-navy-bright'
  )
}
