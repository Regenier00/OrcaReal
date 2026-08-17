import { useState } from 'react'
import { formatMoneyInput, parseMoney } from '@/features/budget/money'
import { cn } from '@/lib/utils'

interface MoneyInputProps {
  label?: string
  value: number
  onChange: (value: number) => void
  onError?: (error: string | null) => void
  error?: string
  disabled?: boolean
  className?: string
  name?: string
}

export function MoneyInput({
  label,
  value,
  onChange,
  onError,
  error,
  disabled,
  className,
  name,
}: MoneyInputProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | undefined>()
  const text = draft ?? formatMoneyInput(value)

  const commit = (raw: string) => {
    const parsed = parseMoney(raw)
    if (!parsed.ok) {
      setLocalError(parsed.error)
      onError?.(parsed.error)
      setDraft(null)
      return
    }
    setLocalError(undefined)
    onError?.(null)
    onChange(parsed.value)
    setDraft(null)
  }

  const shownError = error ?? localError

  return (
    <label className="flex w-full flex-col gap-1 text-left">
      {label ? (
        <span className="text-xs font-medium text-mist">{label}</span>
      ) : null}
      <input
        name={name}
        inputMode="decimal"
        disabled={disabled}
        value={text}
        onChange={(event) => {
          setDraft(event.target.value)
          setLocalError(undefined)
        }}
        onFocus={() => setDraft(formatMoneyInput(value))}
        onBlur={() => commit(draft ?? formatMoneyInput(value))}
        className={cn(
          'w-full rounded-lg border border-paper-muted bg-white px-2.5 py-2 text-right text-sm tabular-nums text-ink',
          'outline-none transition placeholder:text-mist',
          'focus:border-navy-bright focus:ring-2 focus:ring-navy-bright/20',
          shownError && 'border-danger focus:border-danger focus:ring-danger/20',
          className
        )}
      />
      {shownError ? <span className="text-[11px] text-danger">{shownError}</span> : null}
    </label>
  )
}
