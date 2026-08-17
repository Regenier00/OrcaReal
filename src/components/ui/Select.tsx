import type { SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  error?: string
}

export function Select({
  label,
  hint,
  error,
  className,
  id,
  disabled,
  children,
  ...props
}: SelectProps) {
  const selectId = id ?? props.name

  return (
    <label className="flex w-full flex-col gap-1.5 text-left">
      {label ? (
        <span className="text-sm font-medium text-ink-soft/90">{label}</span>
      ) : null}
      <select
        id={selectId}
        disabled={disabled}
        className={cn(
          'w-full rounded-xl border border-paper-muted bg-white px-3.5 py-2.5 text-ink',
          'outline-none transition',
          'focus:border-navy-bright focus:ring-2 focus:ring-navy-bright/20',
          disabled && 'cursor-not-allowed bg-paper text-mist',
          error && 'border-danger focus:border-danger focus:ring-danger/20',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
      {!error && hint ? (
        <span className="text-xs text-mist">{hint}</span>
      ) : null}
    </label>
  )
}
