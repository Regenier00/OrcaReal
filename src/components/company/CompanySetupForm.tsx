import { useMemo, useState } from 'react'
import {
  SEGMENT_OPTIONS,
  isOtherSegment,
  type SegmentCode,
} from '@/features/company/segmentOptions'
import { structureSuggestionsFor, sequentialCostCenterCode } from '@/features/company/structureSuggestions'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { cn } from '@/lib/utils'

export interface CompanySetupValues {
  name: string
  segmentCode: SegmentCode
  customSegment: string
  departments: string[]
  costCenters: string[]
}

interface CompanySetupFormProps {
  initial: CompanySetupValues
  submitting: boolean
  error: string
  onSubmit: (values: CompanySetupValues) => void
  onSkip: () => void
}

export function CompanySetupForm({
  initial,
  submitting,
  error,
  onSubmit,
  onSkip,
}: CompanySetupFormProps) {
  const [name, setName] = useState(initial.name)
  const [segmentCode, setSegmentCode] = useState<SegmentCode>(initial.segmentCode)
  const [customSegment, setCustomSegment] = useState(initial.customSegment)
  const [departments, setDepartments] = useState(initial.departments)
  const [costCenters, setCostCenters] = useState(initial.costCenters)
  const [customDepartment, setCustomDepartment] = useState('')
  const [customCostCenter, setCustomCostCenter] = useState('')
  const [nameError, setNameError] = useState('')
  const [segmentError, setSegmentError] = useState('')

  const suggestions = useMemo(() => structureSuggestionsFor(), [])

  const applySuggestions = () => {
    setDepartments(suggestions.departments)
    setCostCenters(suggestions.costCenters)
  }

  const toggleDepartment = (value: string) => {
    setDepartments((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    )
  }

  const toggleCostCenter = (value: string) => {
    setCostCenters((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    )
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError('Informe o nome da empresa.')
      return
    }
    if (!segmentCode) {
      setSegmentError('Selecione o segmento.')
      return
    }
    setNameError('')
    setSegmentError('')
    onSubmit({
      name: trimmedName,
      segmentCode,
      customSegment: customSegment.trim(),
      departments: departments.map((item) => item.trim()).filter(Boolean),
      costCenters: costCenters.map((item) => item.trim()).filter(Boolean),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Nome da empresa"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={nameError}
          required
        />
        <Select
          label="Segmento"
          value={segmentCode}
          onChange={(event) => setSegmentCode(event.target.value as SegmentCode)}
          error={segmentError}
        >
          {SEGMENT_OPTIONS.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {isOtherSegment(segmentCode) ? (
        <Input
          label="Informe o segmento"
          value={customSegment}
          onChange={(event) => setCustomSegment(event.target.value)}
          placeholder="Ex.: Cooperativa, educação, saúde..."
        />
      ) : null}

      <section className="rounded-2xl border border-paper-muted bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-navy">
              Departamentos
            </h2>
            <p className="mt-1 text-sm text-mist">
              A empresa já nasce com estes departamentos padrão. Você pode
              manter, incluir outros ou ignorar nesta etapa.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={applySuggestions}>
            Usar sugestões
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {suggestions.departments.map((item) => {
            const selected = departments.includes(item)
            return (
              <button
                key={item}
                type="button"
                onClick={() => toggleDepartment(item)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm transition',
                  selected
                    ? 'border-brand bg-brand text-white'
                    : 'border-paper-muted bg-white text-ink-soft hover:border-brand'
                )}
              >
                {item}
              </button>
            )
          })}
        </div>

        <SelectedList
          items={departments}
          onChange={setDepartments}
          placeholder="Nome do departamento"
        />

        <AddRow
          value={customDepartment}
          onChange={setCustomDepartment}
          placeholder="Adicionar departamento"
          onAdd={() => {
            const next = customDepartment.trim()
            if (!next || departments.includes(next)) return
            setDepartments((current) => [...current, next])
            setCustomDepartment('')
          }}
        />
      </section>

      <section className="rounded-2xl border border-paper-muted bg-white p-5">
        <h2 className="font-display text-lg font-semibold text-navy">
          Centros de custo
        </h2>
            <p className="mt-1 text-sm text-mist">
          Cada departamento já nasce com o centro de custo correspondente. O
          código (001, 002…) é gerado automaticamente.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {suggestions.costCenters.map((item) => {
            const selected = costCenters.includes(item)
            return (
              <button
                key={item}
                type="button"
                onClick={() => toggleCostCenter(item)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm transition',
                  selected
                    ? 'border-brand bg-brand text-white'
                    : 'border-paper-muted bg-white text-ink-soft hover:border-brand'
                )}
              >
                {item}
              </button>
            )
          })}
        </div>

        <div className="mt-4 space-y-2">
          {costCenters.map((item, index) => (
            <div key={`${item}-${index}`} className="flex gap-2">
              <span className="inline-flex min-w-14 items-center justify-center rounded-xl border border-paper-muted bg-paper px-2 text-xs font-medium text-navy">
                {sequentialCostCenterCode(index)}
              </span>
              <Input
                value={item}
                onChange={(event) => {
                  const value = event.target.value
                  setCostCenters((current) =>
                    current.map((center, currentIndex) =>
                      currentIndex === index ? value : center
                    )
                  )
                }}
                placeholder="Nome"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setCostCenters((current) =>
                    current.filter((_, currentIndex) => currentIndex !== index)
                  )
                }
              >
                Remover
              </Button>
            </div>
          ))}
        </div>

        <AddRow
          value={customCostCenter}
          onChange={setCustomCostCenter}
          placeholder="Adicionar centro de custo"
          onAdd={() => {
            const next = customCostCenter.trim()
            if (!next || costCenters.includes(next)) return
            setCostCenters((current) => [...current, next])
            setCustomCostCenter('')
          }}
        />
      </section>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="secondary"
          disabled={submitting}
          onClick={onSkip}
        >
          Fazer isso depois
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Salvando...' : 'Configurar agora'}
        </Button>
      </div>
    </form>
  )
}

function SelectedList({
  items,
  onChange,
  placeholder,
}: {
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
}) {
  if (items.length === 0) return null

  return (
    <div className="mt-4 space-y-2">
      {items.map((item, index) => (
        <div key={`${item}-${index}`} className="flex gap-2">
          <Input
            value={item}
            placeholder={placeholder}
            onChange={(event) => {
              const value = event.target.value
              onChange(
                items.map((current, currentIndex) =>
                  currentIndex === index ? value : current
                )
              )
            }}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              onChange(items.filter((_, currentIndex) => currentIndex !== index))
            }
          >
            Remover
          </Button>
        </div>
      ))}
    </div>
  )
}

function AddRow({
  value,
  onChange,
  onAdd,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  onAdd: () => void
  placeholder: string
}) {
  return (
    <div className="mt-4 flex gap-2">
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            onAdd()
          }
        }}
      />
      <Button type="button" variant="secondary" onClick={onAdd}>
        Adicionar
      </Button>
    </div>
  )
}
