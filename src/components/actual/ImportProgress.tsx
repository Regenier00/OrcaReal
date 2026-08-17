import { IMPORT_STEPS, importStepIndex } from '@/features/actual/model'
import type { StatementImportStatus } from '@/types/database'
import { cn } from '@/lib/utils'

export function ImportProgress({
  status,
}: {
  status: StatementImportStatus
}) {
  const current = importStepIndex(status)
  const failed = status === 'failed' || status === 'ocr_required'

  return (
    <ol className="grid gap-2 sm:grid-cols-5">
      {IMPORT_STEPS.map((step, index) => {
        const done = index < current || status === 'completed'
        const active = index === current && status !== 'completed'
        return (
          <li
            key={step.status}
            className={cn(
              'rounded-xl border px-3 py-2 text-xs font-medium',
              failed && index === current
                ? 'border-danger/30 bg-danger/5 text-danger'
                : done
                  ? 'border-ok/30 bg-ok/5 text-ok'
                  : active
                    ? 'border-navy-bright/40 bg-white text-navy'
                    : 'border-paper-muted bg-white text-mist',
            )}
          >
            <span className="block text-[10px] uppercase tracking-wide opacity-70">
              {index + 1}
            </span>
            {step.label}
          </li>
        )
      })}
    </ol>
  )
}
