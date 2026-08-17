import type { TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
}

export function Textarea({
  label,
  hint,
  error,
  className,
  id,
  ...props
}: TextareaProps) {
  const textareaId = id ?? props.name

  return (
    <label className="flex w-full flex-col gap-1.5 text-left">
      {label ? (
        <span className="text-sm font-medium text-ink-soft/90">{label}</span>
      ) : null}
      <textarea
        id={textareaId}
        className={cn(
          'min-h-24 w-full resize-y rounded-xl border border-paper-muted bg-white px-3.5 py-2.5 text-ink',
          'placeholder:text-mist outline-none transition',
          'focus:border-navy-bright focus:ring-2 focus:ring-navy-bright/20',
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
