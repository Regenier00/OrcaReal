import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { formatMoney } from '@/features/budget/money'
import { unitCostForMonth, volumeNoun } from '@/features/experience/unitCost'
import type { UnitCostCardModel } from '@/features/experience/useUnitCostCards'
import type { BudgetMonth } from '@/features/budget/period'
import { cn } from '@/lib/utils'

export function UnitCostCard({
  card,
  months,
  saving,
  onSave,
  kicker,
}: {
  card: UnitCostCardModel
  months: BudgetMonth[]
  saving?: boolean
  onSave: (quantity: number, monthKey: string) => Promise<unknown>
  kicker?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'w-full cursor-pointer rounded-2xl border border-paper-muted bg-white px-4 py-4 text-left transition',
          'hover:border-ink/20 hover:shadow-soft'
        )}
      >
        <p className="text-[11px] uppercase tracking-wide text-mist">
          {kicker ?? card.segmentLabel}
        </p>
        <h3 className="mt-1 font-display text-lg font-semibold text-ink">{card.def.indicatorName}</h3>
        <p className="mt-3 font-numeric text-2xl font-semibold text-ink">
          {card.unitCost == null ? 'Informar quantidade' : formatMoney(card.unitCost)}
        </p>
        <p className="mt-1 text-sm text-mist">{card.def.displayUnit}</p>
        <p className="mt-3 text-xs text-mist">Mês: {card.monthLabel || 'selecione no card'}</p>
        <p className="mt-2 font-mono text-[11px] text-mist">
          custo realizado / {card.def.quantityNoun}
        </p>
      </button>

      {open ? (
        <UnitCostDialog
          card={card}
          months={months}
          saving={saving}
          onClose={() => setOpen(false)}
          onSave={onSave}
        />
      ) : null}
    </>
  )
}

function UnitCostDialog({
  card,
  months,
  saving,
  onClose,
  onSave,
}: {
  card: UnitCostCardModel
  months: BudgetMonth[]
  saving?: boolean
  onClose: () => void
  onSave: (quantity: number, monthKey: string) => Promise<unknown>
}) {
  const [monthKey, setMonthKey] = useState(card.monthKey)
  const [quantityText, setQuantityText] = useState(
    formatInput(card.volumes[card.monthKey] ?? card.quantity)
  )
  const [error, setError] = useState('')

  const selectedMonth = months.find((item) => item.key === monthKey)
  const totalCost = card.costByMonth[monthKey] ?? 0
  const quantity = parseQuantity(quantityText)
  const preview = unitCostForMonth(totalCost, quantity)

  const handleMonthChange = (nextMonth: string) => {
    setMonthKey(nextMonth)
    setQuantityText(formatInput(card.volumes[nextMonth] ?? null))
    setError('')
  }

  const handleSubmit = async () => {
    if (quantity == null) {
      setError('Informe uma quantidade maior que zero.')
      return
    }
    if (!monthKey) {
      setError('Selecione o mês.')
      return
    }
    setError('')
    await onSave(quantity, monthKey)
    onClose()
  }

  return (
    <Dialog
      open
      title={card.def.indicatorName}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={saving} onClick={() => void handleSubmit()}>
            {saving ? 'Salvando...' : 'Calcular'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p>{card.def.quantityHelp}</p>
        <Select
          label="Mês"
          value={monthKey}
          onChange={(event) => handleMonthChange(event.target.value)}
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
        <div className="rounded-xl bg-paper px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-mist">
            Custo total realizado
          </p>
          <p className="mt-1 font-numeric text-lg font-semibold text-ink">
            {formatMoney(totalCost)}
          </p>
          <p className="mt-1 text-xs text-mist">
            {selectedMonth?.fullLabel ?? 'Mês selecionado'}
          </p>
        </div>
        <Input
          label={card.def.quantityPrompt}
          type="text"
          inputMode="decimal"
          value={quantityText}
          onChange={(event) => {
            setQuantityText(event.target.value)
            setError('')
          }}
          hint={`Unidade: ${card.def.quantityNoun}`}
          error={error}
        />
        {preview != null && quantity != null ? (
          <div className="rounded-xl border border-paper-muted px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-mist">Resultado</p>
            <p className="mt-1 font-numeric text-xl font-semibold text-ink">
              {formatMoney(preview)}
            </p>
            <p className="mt-1 text-sm text-mist">{card.def.displayUnit}</p>
            <p className="mt-2 font-mono text-[11px] text-mist">
              {formatMoney(totalCost)} / {formatQuantity(quantity)}{' '}
              {volumeNoun(quantity, card.def.quantityNounSingular, card.def.quantityNoun)} ={' '}
              {formatMoney(preview)}
            </p>
          </div>
        ) : null}
      </div>
    </Dialog>
  )
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
