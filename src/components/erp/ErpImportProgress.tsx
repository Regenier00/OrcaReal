import { ERP_IMPORT_STEPS, erpImportStepIndex } from '@/features/erp/model'
import type { ErpImportStatus } from '@/types/database'
import { cn } from '@/lib/utils'

export function ErpImportProgress({ status }: { status: ErpImportStatus }) {
  const active = erpImportStepIndex(status)
  const failed = status === 'failed'

  return (
    <ol className="grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {ERP_IMPORT_STEPS.map((step, index) => {
        const done = !failed && index < active
        const current = index === active
        return (
          <li
            key={step.status}
            className={cn(
              'rounded-lg px-3 py-2 text-center text-xs font-medium ring-1',
              failed && current
                ? 'bg-red-50 text-red-700 ring-red-200'
                : done
                  ? 'bg-brand/10 text-brand ring-brand/20'
                  : current
                    ? 'bg-ink text-white ring-ink'
                    : 'bg-white text-ink-soft ring-paper-muted',
            )}
          >
            {step.label}
          </li>
        )
      })}
    </ol>
  )
}
