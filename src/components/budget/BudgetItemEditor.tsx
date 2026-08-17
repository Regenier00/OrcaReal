import { useMemo, useState } from 'react'
import type { CompanyStructure } from '@/features/company/structureService'
import { costCentersForDepartment } from '@/features/company/structureService'
import type { BudgetMonth } from '@/features/budget/period'
import type { DraftBudgetItem } from '@/features/budget/model'
import {
  applyPercentToAmounts,
  clearAmounts,
  copyPreviousMonths,
  copyValueToAllMonths,
  distributeAmounts,
  lineTotal,
  CATEGORY_TYPE_LABEL,
} from '@/features/budget/model'
import { formatMoney, parseMoney } from '@/features/budget/money'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'

interface BudgetItemEditorProps {
  structure: CompanyStructure
  months: BudgetMonth[]
  item: DraftBudgetItem
  title: string
  submitLabel: string
  errors?: string[]
  onChange: (item: DraftBudgetItem) => void
  onSubmit: () => void
  onCancel: () => void
}

export function BudgetItemEditor({
  structure,
  months,
  item,
  title,
  submitLabel,
  errors = [],
  onChange,
  onSubmit,
  onCancel,
}: BudgetItemEditorProps) {
  const [distributeOpen, setDistributeOpen] = useState(false)
  const [percentOpen, setPercentOpen] = useState(false)
  const [distributeTotal, setDistributeTotal] = useState('')
  const [percentValue, setPercentValue] = useState('')
  const [helperError, setHelperError] = useState('')

  const costCenters = useMemo(
    () => costCentersForDepartment(structure, item.departmentId),
    [structure, item.departmentId]
  )

  const total = lineTotal(item, months)
  const firstFilled = months.find((month) => (item.amounts[month.key] ?? 0) > 0)

  const setField = <K extends keyof DraftBudgetItem>(
    field: K,
    value: DraftBudgetItem[K]
  ) => {
    onChange({ ...item, [field]: value })
  }

  const setAmount = (key: string, value: number) => {
    onChange({
      ...item,
      amounts: { ...item.amounts, [key]: value },
    })
  }

  const handleDepartmentChange = (departmentId: string) => {
    const nextCenters = costCentersForDepartment(structure, departmentId)
    const costCenterStillValid = nextCenters.some((cc) => cc.id === item.costCenterId)
    onChange({
      ...item,
      departmentId,
      costCenterId: costCenterStillValid ? item.costCenterId : '',
    })
  }

  return (
    <div className="rounded-2xl border border-navy/15 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-semibold text-ink">{title}</h3>
          <p className="mt-1 text-sm text-mist">
            Selecione a estrutura da empresa e informe os valores mensais.
          </p>
        </div>
        <p className="text-sm text-mist">
          Total da linha:{' '}
          <span className="font-semibold tabular-nums text-ink">{formatMoney(total)}</span>
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {structure.businessUnits.length > 0 ? (
          <Select
            label="Unidade de negócio"
            value={item.businessUnitId}
            onChange={(event) => setField('businessUnitId', event.target.value)}
          >
            <option value="">Selecione</option>
            {structure.businessUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </Select>
        ) : null}

        <Select
          label="Departamento"
          value={item.departmentId}
          onChange={(event) => handleDepartmentChange(event.target.value)}
        >
          <option value="">Selecione</option>
          {structure.departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </Select>

        <Select
          label="Centro de custo"
          value={item.costCenterId}
          onChange={(event) => setField('costCenterId', event.target.value)}
        >
          <option value="">Selecione</option>
          {costCenters.map((center) => (
            <option key={center.id} value={center.id}>
              {center.code ? `${center.code} · ${center.name}` : center.name}
            </option>
          ))}
        </Select>

        <Select
          label="Atividade"
          value={item.activityId}
          onChange={(event) => setField('activityId', event.target.value)}
        >
          <option value="">Selecione</option>
          {structure.activities.map((activity) => (
            <option key={activity.id} value={activity.id}>
              {activity.name}
            </option>
          ))}
        </Select>

        <Select
          label="Conta contábil"
          value={item.categoryId}
          onChange={(event) => setField('categoryId', event.target.value)}
        >
          <option value="">Selecione</option>
          {structure.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name} ({CATEGORY_TYPE_LABEL[category.category_type]})
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          className="!px-3 !py-2 !text-xs"
          onClick={() => {
            const source = firstFilled
              ? (item.amounts[firstFilled.key] ?? 0)
              : (item.amounts[months[0]?.key ?? ''] ?? 0)
            onChange({
              ...item,
              amounts: copyValueToAllMonths(item.amounts, months, source),
            })
          }}
        >
          Copiar valor para todos os meses
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="!px-3 !py-2 !text-xs"
          onClick={() =>
            onChange({
              ...item,
              amounts: copyPreviousMonths(item.amounts, months),
            })
          }
        >
          Copiar mês anterior
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="!px-3 !py-2 !text-xs"
          onClick={() =>
            onChange({
              ...item,
              amounts: clearAmounts(months),
            })
          }
        >
          Limpar valores
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="!px-3 !py-2 !text-xs"
          onClick={() => {
            setHelperError('')
            setDistributeTotal('')
            setDistributeOpen(true)
          }}
        >
          Distribuir igualmente
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="!px-3 !py-2 !text-xs"
          onClick={() => {
            setHelperError('')
            setPercentValue('')
            setPercentOpen(true)
          }}
        >
          Aplicar percentual
        </Button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {months.map((month, index) => (
          <div key={month.key} className="rounded-xl border border-paper-muted p-3">
            <MoneyInput
              label={month.fullLabel}
              value={item.amounts[month.key] ?? 0}
              onChange={(value) => setAmount(month.key, value)}
            />
            {index > 0 ? (
              <button
                type="button"
                className="mt-1 text-[11px] font-medium text-navy-bright hover:underline"
                onClick={() =>
                  setAmount(month.key, item.amounts[months[index - 1].key] ?? 0)
                }
              >
                Copiar mês anterior
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {errors.length > 0 ? (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-danger">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" onClick={onSubmit}>
          {submitLabel}
        </Button>
      </div>

      <Dialog
        open={distributeOpen}
        title="Distribuir valor igualmente"
        onClose={() => setDistributeOpen(false)}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setDistributeOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                const parsed = parseMoney(distributeTotal)
                if (!parsed.ok) {
                  setHelperError(parsed.error)
                  return
                }
                onChange({
                  ...item,
                  amounts: distributeAmounts(parsed.value, months),
                })
                setDistributeOpen(false)
              }}
            >
              Distribuir
            </Button>
          </>
        }
      >
        <p className="mb-3">
          O valor será dividido entre os {months.length} meses do período, com
          ajuste de centavos no início.
        </p>
        <Input
          label="Valor total (R$)"
          value={distributeTotal}
          onChange={(event) => setDistributeTotal(event.target.value)}
          placeholder="120000"
        />
        {helperError && distributeOpen ? (
          <p className="mt-2 text-xs text-danger">{helperError}</p>
        ) : null}
      </Dialog>

      <Dialog
        open={percentOpen}
        title="Aplicar percentual"
        onClose={() => setPercentOpen(false)}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setPercentOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                const parsed = Number(percentValue.replace(',', '.'))
                if (!Number.isFinite(parsed)) {
                  setHelperError('Informe um percentual válido. Use negativo para reduzir.')
                  return
                }
                const next = applyPercentToAmounts(item.amounts, months, parsed)
                if (Object.values(next).some((value) => value < 0)) {
                  setHelperError('O percentual deixaria valores negativos. Ajuste e tente de novo.')
                  return
                }
                onChange({ ...item, amounts: next })
                setPercentOpen(false)
              }}
            >
              Aplicar
            </Button>
          </>
        }
      >
        <p className="mb-3">
          Informe o percentual de aumento ou redução sobre os valores atuais da
          linha. Ex.: 10 para aumentar 10%, -5 para reduzir 5%.
        </p>
        <Input
          label="Percentual (%)"
          value={percentValue}
          onChange={(event) => setPercentValue(event.target.value)}
          placeholder="10"
        />
        {helperError && percentOpen ? (
          <p className="mt-2 text-xs text-danger">{helperError}</p>
        ) : null}
      </Dialog>
    </div>
  )
}
