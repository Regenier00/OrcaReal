import { useState } from 'react'
import {
  brandColorContrastWarning,
  parseBrandColor,
  resolveBrandColor,
} from '@/lib/brandColor'
import { cn } from '@/lib/utils'

export function CompanyBrandColorField({
  value,
  disabled,
  error,
  onChange,
}: {
  value: string | null
  disabled?: boolean
  error?: string
  onChange?: (value: string | null) => void
}) {
  const selected = resolveBrandColor(value)
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? selected
  const warning = brandColorContrastWarning(selected)
  const usingDefault = value == null

  const commit = (next: string | null) => {
    if (disabled || !onChange) return
    onChange(next)
  }

  return (
    <div>
      <p className="text-sm font-medium text-ink">Cor da empresa</p>
      <p className="mt-1 text-sm text-mist">
        Aparece em botões, menu e destaques. Os cards de receita e custo
        continuam com as cores padrão do OrcaReal.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          type="color"
          value={selected}
          disabled={disabled}
          onChange={(event) => commit(event.target.value.toLowerCase())}
          aria-label="Escolher cor da empresa"
          className={cn(
            'h-11 w-14 cursor-pointer rounded-xl border border-paper-muted bg-white p-1',
            disabled && 'cursor-not-allowed opacity-55'
          )}
        />
        <input
          value={shown}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={() => setDraft(selected)}
          onBlur={() => {
            const trimmed = (draft ?? selected).trim()
            setDraft(null)
            const parsed = parseBrandColor(trimmed)
            if (!parsed) return
            commit(parsed)
          }}
          spellCheck={false}
          className="w-32 rounded-xl border border-paper-muted bg-white px-3.5 py-2.5 font-mono text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-paper disabled:text-mist"
        />
        {usingDefault ? (
          <span className="text-xs font-medium text-brand">Padrão OrcaReal</span>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => commit(null)}
            className="text-xs font-semibold text-ink-soft underline-offset-2 hover:text-brand hover:underline disabled:cursor-not-allowed disabled:opacity-55"
          >
            Restaurar cor do OrcaReal
          </button>
        )}
      </div>
      {warning ? <p className="mt-2 text-xs text-warn">{warning}</p> : null}
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </div>
  )
}
