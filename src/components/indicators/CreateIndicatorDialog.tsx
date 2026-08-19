import { useMemo, useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { FormulaChip } from '@/components/indicators/FormulaChip'
import { formatMoney } from '@/features/budget/money'
import {
  createCompanyCustomIndicator,
  createCompanyCustomUnit,
} from '@/features/indicators/customIndicatorService'
import {
  FORMULA_METRICS,
  FORMULA_OPS,
  FORMULA_SCOPES,
  defaultCustomFormula,
  evaluateFormula,
  formulaHint,
  formulaUsesQuantity,
  metricMoneySide,
  suggestedDisplayUnit,
  type CustomFormula,
  type FormulaContext,
  type FormulaMetric,
  type FormulaOp,
  type FormulaScope,
} from '@/features/indicators/formula'
import { moneySideCardClass } from '@/components/indicators/moneySideStyle'
import { catalogPickerUnits } from '@/features/indicators/units'
import { cn } from '@/lib/utils'
import type { CompanyCustomUnit } from '@/types/database'

export function CreateIndicatorDialog({
  open,
  companyId,
  customUnits,
  preview,
  onClose,
  onCreated,
}: {
  open: boolean
  companyId: string
  customUnits: CompanyCustomUnit[]
  preview: FormulaContext
  onClose: () => void
  onCreated: () => Promise<unknown> | unknown
}) {
  const catalogUnits = useMemo(() => catalogPickerUnits(), [])
  const [name, setName] = useState('')
  const [unitKey, setUnitKey] = useState('new')
  const [newUnitName, setNewUnitName] = useState('')
  const [newUnitSingular, setNewUnitSingular] = useState('')
  const [newUnitPlural, setNewUnitPlural] = useState('')
  const [formula, setFormula] = useState<CustomFormula>(defaultCustomFormula)
  const [displayOverride, setDisplayOverride] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const selectedUnit = useMemo(() => {
    if (unitKey === 'new') {
      const unitName = newUnitName.trim() || 'Unidade'
      const singular = newUnitSingular.trim() || unitName.toLowerCase()
      const plural = newUnitPlural.trim() || singular
      return {
        source: 'custom' as const,
        code: '',
        name: unitName,
        quantityNoun: plural,
        quantityNounSingular: singular,
        customUnitId: null as string | null,
      }
    }
    if (unitKey.startsWith('custom:')) {
      const id = unitKey.slice('custom:'.length)
      const unit = customUnits.find((item) => item.id === id)
      if (!unit) return null
      return {
        source: 'custom' as const,
        code: unit.code,
        name: unit.name,
        quantityNoun: unit.quantity_noun,
        quantityNounSingular: unit.quantity_noun_singular,
        customUnitId: unit.id,
      }
    }
    const unit = catalogUnits.find((item) => item.key === unitKey)
    if (!unit) return null
    return {
      source: 'catalog' as const,
      code: unit.code,
      name: unit.name,
      quantityNoun: unit.quantityNoun,
      quantityNounSingular: unit.quantityNounSingular,
      customUnitId: null,
    }
  }, [unitKey, newUnitName, newUnitSingular, newUnitPlural, customUnits, catalogUnits])

  const displayUnit =
    displayOverride ??
    (selectedUnit ? suggestedDisplayUnit(formula, selectedUnit.name) : 'R$/unidade')

  const previewValue = selectedUnit
    ? evaluateFormula(formula, preview)
    : null

  const handleSubmit = async () => {
    if (!selectedUnit) {
      setError('Selecione ou crie a unidade de operação.')
      return
    }
    if (!name.trim()) {
      setError('Informe o nome do indicador.')
      return
    }
    if (unitKey === 'new' && !newUnitName.trim()) {
      setError('Informe o nome da nova unidade.')
      return
    }

    setSaving(true)
    setError('')

    let customUnit: CompanyCustomUnit | null = null
    if (unitKey === 'new') {
      const created = await createCompanyCustomUnit({
        companyId,
        name: selectedUnit.name,
        quantityNoun: selectedUnit.quantityNoun,
        quantityNounSingular: selectedUnit.quantityNounSingular,
      })
      if (!created.ok) {
        setSaving(false)
        setError(created.message)
        return
      }
      customUnit = created.data
    } else if (selectedUnit.source === 'custom') {
      customUnit = customUnits.find((item) => item.id === selectedUnit.customUnitId) ?? null
    }

    const created = await createCompanyCustomIndicator({
      companyId,
      name,
      unitSource: selectedUnit.source,
      unitCode: customUnit?.code ?? selectedUnit.code,
      unitName: customUnit?.name ?? selectedUnit.name,
      quantityNoun: customUnit?.quantity_noun ?? selectedUnit.quantityNoun,
      quantityNounSingular:
        customUnit?.quantity_noun_singular ?? selectedUnit.quantityNounSingular,
      customUnitId: customUnit?.id ?? null,
      formula,
      displayUnit,
    })
    setSaving(false)
    if (!created.ok) {
      setError(created.message)
      return
    }
    await onCreated()
    onClose()
  }

  const setOperand = (
    side: 'left' | 'right',
    patch: Partial<{ metric: FormulaMetric; scope: FormulaScope }>
  ) => {
    setFormula((current) => ({
      ...current,
      [side]: { ...current[side], ...patch },
    }))
  }

  return (
    <Dialog
      open={open}
      wide
      title="Criar indicador"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={saving} onClick={() => void handleSubmit()}>
            {saving ? 'Salvando...' : 'Criar indicador'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p>
          Monte o cálculo com receitas e custos realizados, separados, no mês ou no
          consolidado. A quantidade da unidade entra quando você quiser um valor por
          unidade.
        </p>

        <Input
          label="Nome do indicador"
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            setError('')
          }}
          placeholder="Ex.: Receita por caminhão"
        />

        <Select
          label="Unidade de operação"
          value={unitKey}
          onChange={(event) => {
            setUnitKey(event.target.value)
            setError('')
          }}
          hint="Use uma unidade padrão ou crie uma unidade da empresa."
        >
          <option value="new">Nova unidade da empresa</option>
          {customUnits.length > 0 ? (
            <optgroup label="Unidades da empresa">
              {customUnits.map((unit) => (
                <option key={unit.id} value={`custom:${unit.id}`}>
                  {unit.name}
                </option>
              ))}
            </optgroup>
          ) : null}
          <optgroup label="Unidades padrão">
            {catalogUnits.map((unit) => (
              <option key={unit.key} value={unit.key}>
                {unit.name}
              </option>
            ))}
          </optgroup>
        </Select>

        {unitKey === 'new' ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              label="Nome da unidade"
              value={newUnitName}
              onChange={(event) => {
                setNewUnitName(event.target.value)
                setError('')
              }}
              placeholder="Caminhão"
            />
            <Input
              label="Singular"
              value={newUnitSingular}
              onChange={(event) => setNewUnitSingular(event.target.value)}
              placeholder="caminhão"
            />
            <Input
              label="Plural"
              value={newUnitPlural}
              onChange={(event) => setNewUnitPlural(event.target.value)}
              placeholder="caminhões"
            />
          </div>
        ) : null}

        <div className="space-y-3 rounded-xl border border-paper-muted p-4">
          <div>
            <p className="text-sm font-medium text-ink-soft/90">Formato do cálculo</p>
            <p className="mt-1 text-xs text-mist">
              Receitas e custos ficam separados. Escolha o mês atual ou o consolidado
              do período.
            </p>
          </div>

          <FormulaOperandFields
            label="Primeiro valor"
            metric={formula.left.metric}
            scope={formula.left.scope}
            onMetric={(metric) => setOperand('left', { metric })}
            onScope={(scope) => setOperand('left', { scope })}
          />

          <Select
            label="Operação"
            value={formula.op}
            onChange={(event) =>
              setFormula((current) => ({ ...current, op: event.target.value as FormulaOp }))
            }
          >
            {FORMULA_OPS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} ({item.symbol})
              </option>
            ))}
          </Select>

          <FormulaOperandFields
            label="Segundo valor"
            metric={formula.right.metric}
            scope={formula.right.scope}
            onMetric={(metric) => setOperand('right', { metric })}
            onScope={(scope) => setOperand('right', { scope })}
          />
          {formula.right.scope === 'consolidated' ? (
            <p className="text-xs text-mist">
              Com o segundo valor consolidado, a quantidade fica fixa no total do
              período e não pode ser informada mês a mês.
            </p>
          ) : (
            <p className="text-xs text-mist">
              Com o segundo valor por período, você escolhe o mês e informa a
              quantidade daquele mês.
            </p>
          )}

          <FormulaChip name="Prévia" formula={formulaHint(formula)} className="mt-1" />
        </div>

        <Input
          label="Unidade de exibição"
          value={displayUnit}
          onChange={(event) => setDisplayOverride(event.target.value)}
          hint="Ex.: R$/caminhão, R$/hectare ou x"
        />

        <div className="rounded-xl bg-paper px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-mist">Prévia com o realizado</p>
          <p className="mt-1 font-numeric text-lg font-semibold text-ink">
            {previewValue == null
              ? formulaUsesQuantity(formula)
                ? 'Informe a quantidade no card para calcular'
                : 'Sem dados suficientes'
              : formatMoney(previewValue)}
          </p>
          <p className="mt-1 text-xs text-mist">{displayUnit}</p>
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>
    </Dialog>
  )
}

function FormulaOperandFields({
  label,
  metric,
  scope,
  onMetric,
  onScope,
}: {
  label: string
  metric: FormulaMetric
  scope: FormulaScope
  onMetric: (value: FormulaMetric) => void
  onScope: (value: FormulaScope) => void
}) {
  return (
    <div
      className={cn(
        'grid gap-3 rounded-xl border p-3 sm:grid-cols-2',
        moneySideCardClass(metricMoneySide(metric))
      )}
    >
      <Select
        label={label}
        value={metric}
        onChange={(event) => onMetric(event.target.value as FormulaMetric)}
      >
        {FORMULA_METRICS.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </Select>
      <Select
        label="Abrangência"
        value={scope}
        onChange={(event) => onScope(event.target.value as FormulaScope)}
      >
        {FORMULA_SCOPES.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </Select>
    </div>
  )
}
