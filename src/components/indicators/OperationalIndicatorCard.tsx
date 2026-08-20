import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatMoney } from '@/features/budget/money'
import { ChangeBadge } from '@/components/home/ChangeBadge'
import { cn } from '@/lib/utils'
import { formatOperationalValue, evaluateBreakdown } from '@/features/indicators/operationalDisplay'
import {
  evaluateOperationalFormula,
  formulaBaseMetrics,
} from '@/features/indicators/operationalFormula'
import { FormulaChip } from '@/components/indicators/FormulaChip'
import type { OperationalCardModel } from '@/features/experience/useOperationalIndicators'
import type { OperationalInputDef } from '@/features/experience/catalog/operationModels'
import { moneySideHeaderClass } from '@/components/indicators/moneySideStyle'

export function OperationalIndicatorCard({
  card,
  saving,
  onSave,
}: {
  card: OperationalCardModel
  saving?: boolean
  onSave: (
    values: Record<string, number>,
    monthKey: string
  ) => Promise<{ ok: boolean; message?: string } | void>
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
        className="flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-paper-muted bg-white text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-soft"
      >
        <div
          className={cn(
            'flex items-center justify-between gap-3 px-4 py-3',
            moneySideHeaderClass(surface)
          )}
        >
          <h3 className="font-display text-sm font-semibold tracking-tight">
            {card.def.name}
          </h3>
        </div>
        <div className="relative flex flex-1 flex-col items-center justify-center bg-white px-4 py-6">
          <div className="absolute right-3 top-3">
            <ChangeBadge value={card.change} invert={invert} />
          </div>
          <p className="text-center font-numeric text-2xl font-semibold tracking-tight text-navy sm:text-[1.7rem]">
            {card.value == null
              ? needsInputs
                ? 'Informar dados'
                : 'Sem dados'
              : formatOperationalValue(card.value, card.def.format)}
          </p>
          <p className="mt-2 text-center text-sm leading-relaxed text-mist">{card.def.unit}</p>
        </div>
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
  onSave: (
    values: Record<string, number>,
    monthKey: string
  ) => Promise<{ ok: boolean; message?: string } | void>
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
  const bases = formulaBaseMetrics(card.def.formula)
  const factBoxes = [
    bases.has('revenue')
      ? { label: 'Receita do período', value: formatMoney(card.context.revenue) }
      : null,
    bases.has('cost')
      ? { label: 'Custos do período', value: formatMoney(card.context.cost) }
      : null,
    bases.has('expense')
      ? { label: 'Despesas do período', value: formatMoney(card.context.expense) }
      : null,
    bases.has('previousRevenue') && card.context.previousRevenue != null
      ? {
          label: 'Receita do período anterior',
          value: formatMoney(card.context.previousRevenue),
        }
      : null,
    bases.has('employeeCount') && card.context.employeeCount != null
      ? {
          label: 'Funcionários',
          value: String(card.context.employeeCount),
        }
      : null,
  ].filter((item): item is { label: string; value: string } => item != null)

  const handleSubmit = async () => {
    if (card.def.inputs.length > 0 && parsed.missing.length > 0) {
      setError(`Informe: ${parsed.missing.join(', ')}.`)
      return
    }
    setError('')
    if (card.def.inputs.length > 0) {
      const result = await onSave(parsed.values, card.monthKey)
      if (result && !result.ok) {
        setError(result.message ?? 'Não foi possível salvar os dados.')
        return
      }
    }
    onClose()
  }

  return (
    <Dialog
      open
      wide={card.def.inputs.length > 2 || breakdown.length > 0 || factBoxes.length > 2}
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
        <FormulaChip name={card.def.name} formula={card.def.formulaHint} className="mt-1" />
        {card.monthLabel ? (
          <p className="text-xs text-mist">Período: {card.monthLabel}</p>
        ) : null}

        {factBoxes.length > 0 ? (
          <div
            className={cn(
              'grid gap-3',
              factBoxes.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
            )}
          >
            {factBoxes.map((item) => (
              <FactBox key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
        ) : null}

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
          <div className="rounded-xl border border-paper-muted px-4 py-3 text-center">
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
