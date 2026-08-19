import { cn } from '@/lib/utils'

export function FormulaChip({
  name,
  formula,
  className,
  tone = 'light',
  capture = true,
}: {
  name?: string
  formula: string
  className?: string
  tone?: 'light' | 'dark'
  capture?: boolean
}) {
  return (
    <p
      data-tour-formula={capture ? formula : undefined}
      data-tour-formula-name={capture ? name : undefined}
      className={cn(
        'mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-left',
        className
      )}
    >
      <span
        className={cn(
          'rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]',
          tone === 'dark' ? 'bg-white/12 text-sky' : 'bg-navy-soft text-navy-bright'
        )}
      >
        Fórmula
      </span>
      <span
        className={cn(
          'font-mono text-[11px] leading-snug',
          tone === 'dark' ? 'text-white/85' : 'text-navy/80'
        )}
      >
        {formula}
      </span>
    </p>
  )
}
