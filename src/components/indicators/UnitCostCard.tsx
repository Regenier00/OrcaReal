import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { formatMoney } from '@/features/budget/money'
import { volumeNoun } from '@/features/experience/unitCost'
import type { UnitCostCardModel } from '@/features/experience/useUnitCostCards'
import type { BudgetMonth } from '@/features/budget/period'
import { ChangeBadge } from '@/components/home/ChangeBadge'
import { CalculatorIcon } from '@/components/home/DashboardIcons'
import { cn } from '@/lib/utils'
import {
  CONSOLIDATED_VOLUME_KEY,
  consolidatedQuantity,
  evaluateFormula,
  FORMULA_METRICS,
  formulaHint,
  formulaMoneySide,
  metricMoneySide,
  operandLabel,
  quantityVolumeKey,
  readOperandValue,
  type CustomFormula,
  type FormulaContext,
} from '@/features/indicators/formula'
import { moneySideCardClass, moneySideIconClass } from '@/components/indicators/moneySideStyle'

export function UnitCostCard({
  card,
  months,
  saving,
  onSave,
  onDelete,
  kicker,
}: {
  card: UnitCostCardModel
  months: BudgetMonth[]
  saving?: boolean
  onSave: (quantity: number, monthKey: string) => Promise<unknown>
  onDelete?: () => Promise<unknown>
  kicker?: string
}) {
  const [open, setOpen] = useState(false)
  const side = formulaMoneySide(card.formula)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex h-full w-full cursor-pointer flex-col rounded-2xl border p-5 text-left shadow-card transition',
          moneySideCardClass(side, true)
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              moneySideIconClass(side)
            )}
          >
            <CalculatorIcon />
          </span>
          <ChangeBadge value={card.unitCostChange} invert={card.formula.left.metric === 'actual_cost'} />
        </div>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-mist">
          {kicker ?? card.segmentLabel}
        </p>
        <h3 className="mt-1 font-display text-sm font-medium text-navy/80">
          {card.def.indicatorName}
        </h3>
        <p className="mt-3 font-numeric text-2xl font-semibold tracking-tight text-navy sm:text-[1.7rem]">
          {card.unitCost == null
            ? card.usesQuantity
              ? 'Informar quantidade'
              : 'Sem dados'
            : formatResult(card.unitCost, card.formula)}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-mist">
          {card.quantity != null
            ? `${formatQuantity(card.quantity)} ${volumeNoun(
                card.quantity,
                card.def.quantityNounSingular,
                card.def.quantityNoun
              )} ${
                card.quantityIsConsolidated
                  ? 'no consolidado'
                  : `em ${card.monthLabel || 'mês atual'}`
              }`
            : `${card.def.displayUnit} · ${card.formulaHint}`}
        </p>
      </button>

      {open ? (
        <IndicatorDialog
          card={card}
          months={months}
          saving={saving}
          onClose={() => setOpen(false)}
          onSave={onSave}
          onDelete={onDelete}
        />
      ) : null}
    </>
  )
}

function IndicatorDialog({
  card,
  months,
  saving,
  onClose,
  onSave,
  onDelete,
}: {
  card: UnitCostCardModel
  months: BudgetMonth[]
  saving?: boolean
  onClose: () => void
  onSave: (quantity: number, monthKey: string) => Promise<unknown>
  onDelete?: () => Promise<unknown>
}) {
  const canChangePeriod = card.canChangePeriod
  const quantityIsConsolidated = card.quantityIsConsolidated
  const [monthKey, setMonthKey] = useState(card.monthKey)
  const [quantityText, setQuantityText] = useState(
    formatInput(
      quantityIsConsolidated
        ? (card.volumes[CONSOLIDATED_VOLUME_KEY] ?? card.quantity)
        : (card.volumes[card.monthKey] ?? card.quantity)
    )
  )
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)

  const selectedMonth = months.find((item) => item.key === monthKey)
  const quantity = parseQuantity(quantityText)
  const volumeKey = quantityVolumeKey(card.formula, monthKey)
  const volumes = {
    ...card.volumes,
    ...(quantity != null ? { [volumeKey]: quantity } : {}),
  }
  const context: FormulaContext = {
    period: card.totalsByMonth[monthKey] ?? { revenue: 0, cost: 0 },
    consolidated: card.consolidated,
    periodQuantity: quantityIsConsolidated
      ? null
      : (quantity ?? card.volumes[monthKey] ?? null),
    consolidatedQuantity: consolidatedQuantity(volumes),
  }
  const preview = evaluateFormula(card.formula, context)
  const leftValue = readOperandValue(card.formula.left, context)
  const rightValue = readOperandValue(card.formula.right, context)

  const handleMonthChange = (nextMonth: string) => {
    if (!canChangePeriod) return
    setMonthKey(nextMonth)
    if (!quantityIsConsolidated) {
      setQuantityText(formatInput(card.volumes[nextMonth] ?? null))
    }
    setError('')
  }

  const handleSubmit = async () => {
    if (card.usesQuantity) {
      if (quantity == null) {
        setError('Informe uma quantidade maior que zero.')
        return
      }
      if (canChangePeriod && !monthKey) {
        setError('Selecione o mês.')
        return
      }
      setError('')
      await onSave(quantity, volumeKey)
    }
    onClose()
  }

  const handleDelete = async () => {
    if (!onDelete) return
    setDeleting(true)
    await onDelete()
    setDeleting(false)
    onClose()
  }

  return (
    <Dialog
      open
      title={card.def.indicatorName}
      onClose={onClose}
      footer={
        <>
          {onDelete ? (
            <Button
              type="button"
              variant="danger"
              disabled={deleting}
              onClick={() => void handleDelete()}
              className="mr-auto"
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          ) : null}
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={saving} onClick={() => void handleSubmit()}>
            {saving ? 'Salvando...' : card.usesQuantity ? 'Calcular' : 'Fechar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p>{card.def.quantityHelp}</p>
        <p className="font-mono text-[11px] text-mist">{formulaHint(card.formula)}</p>
        {canChangePeriod ? (
          <Select
            label="Mês"
            value={monthKey}
            onChange={(event) => handleMonthChange(event.target.value)}
            hint="O segundo operador usa a quantidade do mês selecionado."
          >
            {months.length === 0 ? (
              <option value="">Sem meses disponíveis</option>
            ) : (
              months.map((month) => (
                <option key={month.key} value={month.key}>
                  {month.fullLabel}
                </option>
              ))
            )}
          </Select>
        ) : (
          <Select
            label="Período"
            value={CONSOLIDATED_VOLUME_KEY}
            disabled
            hint="O segundo operador ficou consolidado: a quantidade não muda por mês."
          >
            <option value={CONSOLIDATED_VOLUME_KEY}>Período consolidado</option>
          </Select>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <OperandBox operand={card.formula.left} value={leftValue} />
          <OperandBox operand={card.formula.right} value={rightValue} />
        </div>
        <p className="text-xs text-mist">
          {canChangePeriod
            ? `${selectedMonth?.fullLabel ?? 'Mês selecionado'} · receitas e custos do realizado, sem misturar os dois totais.`
            : 'Receitas e custos consolidados do realizado, sem misturar os dois totais.'}
        </p>

        {card.usesQuantity ? (
          <Input
            label={
              quantityIsConsolidated
                ? `Qual a quantidade consolidada de ${card.def.quantityNoun}?`
                : card.def.quantityPrompt
            }
            type="text"
            inputMode="decimal"
            value={quantityText}
            onChange={(event) => {
              setQuantityText(event.target.value)
              setError('')
            }}
            hint={
              quantityIsConsolidated
                ? `Unidade: ${card.def.quantityNoun} · valor único do consolidado`
                : `Unidade: ${card.def.quantityNoun}`
            }
            error={error}
          />
        ) : null}

        {preview != null ? (
          <div className="rounded-xl border border-paper-muted px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-mist">Resultado</p>
            <p className="mt-1 font-numeric text-xl font-semibold text-ink">
              {formatResult(preview, card.formula)}
            </p>
            <p className="mt-1 text-sm text-mist">{card.def.displayUnit}</p>
          </div>
        ) : null}
      </div>
    </Dialog>
  )
}

function OperandBox({
  operand,
  value,
}: {
  operand: CustomFormula['left']
  value: number | null
}) {
  const metric = FORMULA_METRICS.find((item) => item.id === operand.metric)
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3',
        moneySideCardClass(metricMoneySide(operand.metric))
      )}
    >
      <p className="text-[11px] uppercase tracking-wide text-mist">{operandLabel(operand)}</p>
      <p className="mt-1 font-numeric text-lg font-semibold text-ink">
        {value == null
          ? '—'
          : metric?.money
            ? formatMoney(value)
            : formatQuantity(value)}
      </p>
    </div>
  )
}

function formatResult(value: number, formula: CustomFormula) {
  const leftMoney = formula.left.metric !== 'quantity'
  const rightMoney = formula.right.metric !== 'quantity'
  if (formula.op === 'div' && leftMoney && rightMoney) {
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)
  }
  if (leftMoney || rightMoney) return formatMoney(value)
  return formatQuantity(value)
}

function parseQuantity(input: string): number | null {
  const raw = input.trim().replace(/\s/g, '')
  if (!raw) return null
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw
  const value = Number(normalized)
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 2,
  }).format(value)
}

function formatInput(value: number | null | undefined) {
  if (value == null) return ''
  return String(value).replace('.', ',')
}
