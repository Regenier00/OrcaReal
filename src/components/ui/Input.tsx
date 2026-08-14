import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
}

export function Input({
  label,
  hint,
  error,
  className,
  id,
  ...props
}: InputProps) {
  const inputId = id ?? props.name

  return (
    <label className="flex w-full flex-col gap-1.5 text-left">
      {label ? (
        <span className="text-sm font-medium text-ink-soft/90">{label}</span>
      ) : null}
      <input
        id={inputId}
        className={cn(
          'w-full rounded-xl border border-paper-muted bg-white px-3.5 py-2.5 text-ink',
          'placeholder:text-mist outline-none transition',
          'focus:border-navy-bright focus:ring-2 focus:ring-sky/25',
          error && 'border-danger focus:border-danger focus:ring-danger/20',
          className
        )}
        {...props}
      />
      {error ? <span className="text-xs text-danger">{error}</span> : null}
      {!error && hint ? (
        <span className="text-xs text-mist">{hint}</span>
      ) : null}
    </label>
  )
}
