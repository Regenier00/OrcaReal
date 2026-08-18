import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatMoney } from '@/features/budget/money'
import { ChangeBadge } from '@/components/home/ChangeBadge'
import { CalculatorIcon } from '@/components/home/DashboardIcons'
import { cn } from '@/lib/utils'
import { formatOperationalValue, evaluateBreakdown } from '@/features/indicators/operationalDisplay'
import { evaluateOperationalFormula } from '@/features/indicators/operationalFormula'
import type { OperationalCardModel } from '@/features/experience/useOperationalIndicators'
import type { OperationalInputDef } from '@/features/experience/catalog/operationModels'
import { moneySideCardClass, moneySideIconClass } from '@/components/indicators/moneySideStyle'

export function OperationalIndicatorCard({
  card,
  saving,
  onSave,
}: {
  card: OperationalCardModel
  saving?: boolean
  onSave: (values: Record<string, number>, monthKey: string) => Promise<unknown>
}) {
  const [open, setOpen] = useState(false)
  const invert = /custo|cac|ociosidade|dependência/i.test(card.def.name)
  const needsInputs = card.def.inputs.length > 0
  const surface = invert ? 'cost' : card.def.format === 'money' ? 'revenue' : null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex h-full w-full cursor-pointer flex-col rounded-2xl border p-5 text-left shadow-card transition',
          moneySideCardClass(surface, true)
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              moneySideIconClass(surface)
            )}
          >
            <CalculatorIcon />
          </span>
          <ChangeBadge value={card.change} invert={invert} />
        </div>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-mist">
          {card.model.label}
        </p>
        <h3 className="mt-1 font-display text-sm font-medium text-navy/80">
          {card.def.name}
        </h3>
        <p className="mt-3 font-numeric text-2xl font-semibold tracking-tight text-navy sm:text-[1.7rem]">
          {card.value == null
            ? needsInputs
              ? 'Informar dados'
              : 'Sem dados'
            : formatOperationalValue(card.value, card.def.format)}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-mist">
          {card.def.unit} · {card.def.formulaHint}
        </p>
      </button>

      {open ? (
        <OperationalDialog
          card={card}
          saving={saving}
          onClose={() => setOpen(false)}
          onSave={onSave}
        />
      ) : null}
    </>
  )
}

function OperationalDialog({
  card,
  saving,
  onClose,
  onSave,
}: {
  card: OperationalCardModel
  saving?: boolean
  onClose: () => void
  onSave: (values: Record<string, number>, monthKey: string) => Promise<unknown>
}) {
  const [texts, setTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      card.def.inputs.map((item) => [item.key, formatInput(card.inputs[item.key])])
    )
  )
  const [error, setError] = useState('')

  const parsed = parseInputs(card.def.inputs, texts)
  const context = {
    ...card.context,
    inputs: { ...card.inputs, ...parsed.values },
  }
  const preview = evaluateOperationalFormula(card.def.formula, context)
  const breakdown = card.def.breakdown ? evaluateBreakdown(card.def.breakdown, context) : []

  const handleSubmit = async () => {
    if (card.def.inputs.length > 0 && parsed.missing.length > 0) {
      setError(`Informe: ${parsed.missing.join(', ')}.`)
      return
    }
    setError('')
    if (card.def.inputs.length > 0) {
      await onSave(parsed.values, card.monthKey)
    }
    onClose()
  }

  return (
    <Dialog
      open
      wide={card.def.inputs.length > 2 || breakdown.length > 0}
      title={card.def.name}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={saving} onClick={() => void handleSubmit()}>
            {saving ? 'Salvando...' : card.def.inputs.length > 0 ? 'Calcular' : 'Fechar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p>{card.def.description}</p>
        <p className="font-mono text-[11px] text-mist">{card.def.formulaHint}</p>
        {card.monthLabel ? (
          <p className="text-xs text-mist">Período: {card.monthLabel}</p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <FactBox label="Receita do período" value={formatMoney(card.context.revenue)} />
          <FactBox label="Custos do período" value={formatMoney(card.context.cost)} />
        </div>

        {card.def.inputs.map((item) => (
          <Input
            key={item.key}
            label={item.prompt}
            type="text"
            inputMode="decimal"
            value={texts[item.key] ?? ''}
            onChange={(event) => {
              setTexts((current) => ({ ...current, [item.key]: event.target.value }))
              setError('')
            }}
            hint={item.help}
          />
        ))}

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {breakdown.length > 0 ? (
          <dl className="grid gap-2 sm:grid-cols-3">
            {breakdown.map((item) => (
              <div key={item.label} className="rounded-xl border border-paper-muted px-3 py-2">
                <dt className="text-[11px] uppercase tracking-wide text-mist">{item.label}</dt>
                <dd className="mt-1 font-numeric text-sm font-semibold text-ink">
                  {formatOperationalValue(item.value, card.def.format)}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {preview != null ? (
          <div className="rounded-xl border border-paper-muted px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-mist">Resultado</p>
            <p className="mt-1 font-numeric text-xl font-semibold text-ink">
              {formatOperationalValue(preview, card.def.format)}
            </p>
            <p className="mt-1 text-sm text-mist">{card.def.unit}</p>
          </div>
        ) : null}
      </div>
    </Dialog>
  )
}

function FactBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-paper-muted px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-mist">{label}</p>
      <p className="mt-1 font-numeric text-lg font-semibold text-ink">{value}</p>
    </div>
  )
}

function parseInputs(
  defs: OperationalInputDef[],
  texts: Record<string, string>
): { values: Record<string, number>; missing: string[] } {
  const values: Record<string, number> = {}
  const missing: string[] = []
  for (const def of defs) {
    const parsed = parseQuantity(texts[def.key] ?? '')
    if (parsed == null) missing.push(def.label)
    else values[def.key] = parsed
  }
  return { values, missing }
}

function parseQuantity(input: string): number | null {
  const raw = input.trim().replace(/\s/g, '')
  if (!raw) return null
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw
  const value = Number(normalized)
  if (!Number.isFinite(value) || value < 0) return null
  return value
}

function formatInput(value: number | null | undefined) {
  if (value == null) return ''
  return String(value).replace('.', ',')
}
