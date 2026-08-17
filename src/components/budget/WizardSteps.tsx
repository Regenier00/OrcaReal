import { cn } from '@/lib/utils'

const DEFAULT_STEPS = [
  { id: 1, label: 'Período' },
  { id: 2, label: 'Itens' },
  { id: 3, label: 'Revisar' },
] as const

interface WizardStepsProps {
  current: number
  steps?: ReadonlyArray<{ id: number; label: string }>
}

export function WizardSteps({
  current,
  steps = DEFAULT_STEPS,
}: WizardStepsProps) {
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {steps.map((step, index) => {
        const done = current > step.id
        const active = current === step.id
        return (
          <li key={step.id} className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-semibold',
                active && 'bg-navy text-paper',
                done && 'bg-ok text-white',
                !active && !done && 'bg-paper-muted text-mist'
              )}
            >
              {step.id}
            </span>
            <span
              className={cn(
                'text-sm',
                active ? 'font-semibold text-ink' : 'text-mist'
              )}
            >
              {step.label}
            </span>
            {index < steps.length - 1 ? (
              <span className="mx-1 hidden text-paper-muted sm:inline">→</span>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
