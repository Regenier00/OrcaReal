import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCompany } from '@/features/company/useCompany'
import {
  loadCompanyStructure,
  type CompanyStructure,
} from '@/features/company/structureService'
import {
  getCompanyBudget,
  saveCompanyBudget,
  toDraft,
} from '@/features/budget/budgetService'
import type { DraftBudget, DraftBudgetItem } from '@/features/budget/model'
import {
  duplicateItem,
  emptyAmounts,
  remapAmounts,
  createEmptyItem,
} from '@/features/budget/model'
import {
  calendarYearBounds,
  currentFiscalYear,
  defaultBudgetName,
  inferPeriodKind,
  monthsBetween,
  periodLabelForYear,
} from '@/features/budget/period'
import {
  findDuplicateStructure,
  validateBudgetForSave,
  validateBudgetItem,
  validateBudgetMeta,
} from '@/features/budget/validation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { CompanyRequired } from '@/components/company/CompanyRequired'
import { WizardSteps } from '@/components/budget/WizardSteps'
import { BudgetSummaryBar } from '@/components/budget/BudgetSummaryBar'
import { BudgetItemEditor } from '@/components/budget/BudgetItemEditor'
import { BudgetItemsTable } from '@/components/budget/BudgetItemsTable'

function createDraft(year = currentFiscalYear()): DraftBudget {
  const bounds = calendarYearBounds(year)
  return {
    name: defaultBudgetName(year),
    fiscalYear: year,
    periodLabel: periodLabelForYear(year),
    periodKind: 'calendar_year',
    startDate: bounds.startDate,
    endDate: bounds.endDate,
    businessUnitId: '',
    notes: '',
    status: 'draft',
    items: [],
  }
}

export function BudgetWizardPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { company, loading: companyLoading } = useCompany()

  const [step, setStep] = useState(1)
  const [draft, setDraft] = useState<DraftBudget>(createDraft)
  const [nameTouched, setNameTouched] = useState(isEdit)
  const [labelTouched, setLabelTouched] = useState(isEdit)
  const [structure, setStructure] = useState<CompanyStructure | null>(null)
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [metaErrors, setMetaErrors] = useState<string[]>([])
  const [editor, setEditor] = useState<DraftBudgetItem | null>(null)
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create')
  const [editorErrors, setEditorErrors] = useState<string[]>([])
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const fetchKey = company ? `${company.id}:${id ?? 'new'}` : null

  useEffect(() => {
    if (!company) return
    const companyId = company.id
    const key = `${companyId}:${id ?? 'new'}`
    let mounted = true

    const load = async () => {
      const nextStructure = await loadCompanyStructure(companyId)
      if (!mounted) return
      setStructure(nextStructure)

      if (id) {
        const budget = await getCompanyBudget(companyId, id)
        if (!mounted) return
        if (!budget) {
          setError('Orçamento não encontrado nesta empresa.')
          setFetchedFor(key)
          return
        }
        const nextDraft = toDraft(budget)
        nextDraft.items = nextDraft.items.map((item) => ({
          ...item,
          amounts: remapAmounts(
            item.amounts,
            monthsBetween(nextDraft.startDate, nextDraft.endDate)
          ),
        }))
        setDraft(nextDraft)
        setError('')
      } else {
        const fresh = createDraft()
        if (nextStructure.businessUnits.length === 1) {
          fresh.businessUnitId = nextStructure.businessUnits[0].id
        }
        setDraft(fresh)
        setError('')
      }
      setFetchedFor(key)
    }

    void load().catch((err: unknown) => {
      if (!mounted) return
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o orçamento.')
      setFetchedFor(key)
    })

    return () => {
      mounted = false
    }
  }, [company, id])

  const loading = Boolean(fetchKey) && fetchedFor !== fetchKey

  const months = useMemo(
    () => monthsBetween(draft.startDate, draft.endDate),
    [draft.startDate, draft.endDate]
  )

  const labels = useMemo(() => {
    const lookup = (list: { id: string; name: string }[]) => {
      const map = new Map(list.map((item) => [item.id, item.name]))
      return (value: string) => map.get(value) ?? ''
    }
    return {
      businessUnit: lookup(structure?.businessUnits ?? []),
      department: lookup(structure?.departments ?? []),
      costCenter: lookup(structure?.costCenters ?? []),
      activity: lookup(structure?.activities ?? []),
      category: lookup(structure?.categories ?? []),
    }
  }, [structure])

  const applyYear = (year: number) => {
    const bounds = calendarYearBounds(year)
    setDraft((current) => ({
      ...current,
      fiscalYear: year,
      periodKind: 'calendar_year',
      startDate: bounds.startDate,
      endDate: bounds.endDate,
      periodLabel: labelTouched ? current.periodLabel : periodLabelForYear(year),
      name: nameTouched ? current.name : defaultBudgetName(year),
      items: current.items.map((item) => ({
        ...item,
        amounts: remapAmounts(item.amounts, monthsBetween(bounds.startDate, bounds.endDate)),
      })),
    }))
  }

  const applyDates = (startDate: string, endDate: string) => {
    setDraft((current) => ({
      ...current,
      startDate,
      endDate,
      periodKind: inferPeriodKind(current.fiscalYear, startDate, endDate),
      items: current.items.map((item) => ({
        ...item,
        amounts: remapAmounts(item.amounts, monthsBetween(startDate, endDate)),
      })),
    }))
  }

  const goToItems = () => {
    const errors = validateBudgetMeta(draft)
    setMetaErrors(errors)
    if (errors.length > 0) return
    setStep(2)
  }

  const openNewItem = () => {
    setEditorMode('create')
    setEditorErrors([])
    setEditor(createEmptyItem(months, draft.businessUnitId))
  }

  const openEditItem = (localId: string) => {
    const item = draft.items.find((row) => row.localId === localId)
    if (!item || !structure) return
    setEditorMode('edit')
    setEditorErrors([])
    setEditor({
      ...item,
      amounts: remapAmounts(item.amounts, months),
    })
  }

  const openDuplicateItem = (localId: string) => {
    const item = draft.items.find((row) => row.localId === localId)
    if (!item) return
    setEditorMode('create')
    setEditorErrors([
      'Linha duplicada. Altere ao menos um campo da estrutura antes de adicionar.',
    ])
    setEditor(duplicateItem(item, months))
  }

  const submitEditor = () => {
    if (!editor || !structure) return
    const errors = validateBudgetItem(editor, structure)
    const duplicate = findDuplicateStructure(
      draft.items,
      editor,
      editorMode === 'edit' ? editor.localId : undefined
    )
    if (duplicate) {
      errors.push(
        'Já existe uma linha com esta combinação de unidade, departamento, centro de custo, atividade e conta neste orçamento.'
      )
    }
    setEditorErrors(errors)
    if (errors.length > 0) return

    setDraft((current) => {
      if (editorMode === 'edit') {
        return {
          ...current,
          items: current.items.map((item) =>
            item.localId === editor.localId ? { ...editor, amounts: remapAmounts(editor.amounts, months) } : item
          ),
        }
      }
      return {
        ...current,
        items: [
          ...current.items,
          { ...editor, amounts: remapAmounts(editor.amounts, months) },
        ],
      }
    })
    setEditor(null)
    setEditorErrors([])
  }

  const confirmDeleteItem = () => {
    if (!pendingDeleteId) return
    setDraft((current) => ({
      ...current,
      items: current.items.filter((item) => item.localId !== pendingDeleteId),
    }))
    if (editor?.localId === pendingDeleteId) setEditor(null)
    setPendingDeleteId(null)
  }

  const save = async () => {
    if (!company || !structure) return
    const errors = validateBudgetForSave(draft, structure)
    if (errors.length > 0) {
      setError(errors[0])
      setMetaErrors(errors)
      if (validateBudgetMeta(draft).length > 0) setStep(1)
      return
    }

    setSaving(true)
    setError('')
    try {
      const budgetId = await saveCompanyBudget(company.id, {
        ...draft,
        items: draft.items.map((item) => ({
          ...item,
          amounts: months.reduce(
            (acc, month) => {
              acc[month.key] = item.amounts[month.key] ?? 0
              return acc
            },
            { ...emptyAmounts(months) }
          ),
        })),
      })
      navigate(`/app/orcamentos/${budgetId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o orçamento.')
    } finally {
      setSaving(false)
    }
  }

  if (!companyLoading && !company) {
    return (
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">Novo orçamento</h1>
        <div className="mt-6">
          <CompanyRequired />
        </div>
      </div>
    )
  }

  if (loading) {
    return <p className="text-sm text-mist">Carregando orçamento...</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-mist">
            {isEdit ? 'Editar orçamento' : 'Novo orçamento'}
          </p>
          <h1 className="font-display text-3xl font-bold text-ink">
            {isEdit ? 'Atualizar orçamento' : 'Criar orçamento'}
          </h1>
        </div>
        <WizardSteps current={step} />
      </div>

      <BudgetSummaryBar
        draft={draft}
        months={months}
        companyName={company?.trade_name || company?.name}
      />

      {error ? (
        <p className="rounded-xl border border-danger/20 bg-white px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {step === 1 ? (
        <section className="rounded-2xl border border-paper-muted bg-white p-6">
          <h2 className="font-display text-xl font-semibold text-ink">
            Informações gerais
          </h2>
          <p className="mt-1 text-sm text-mist">
            O exercício padrão do OrcaReal é janeiro a dezembro. O rótulo 2026/2027
            corresponde a janeiro/2026 até dezembro/2026. As datas podem ser
            ajustadas para outros períodos.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Input
              label="Nome do orçamento"
              value={draft.name}
              onChange={(event) => {
                setNameTouched(true)
                setDraft((current) => ({ ...current, name: event.target.value }))
              }}
              required
            />
            <Input
              label="Ano / período"
              type="number"
              min={2000}
              max={2100}
              value={draft.fiscalYear}
              onChange={(event) => {
                const year = Number(event.target.value)
                if (!Number.isInteger(year)) return
                applyYear(year)
              }}
              hint={`Rótulo sugerido: ${periodLabelForYear(draft.fiscalYear)}`}
            />
            <Input
              label="Rótulo do período"
              value={draft.periodLabel}
              onChange={(event) => {
                setLabelTouched(true)
                setDraft((current) => ({
                  ...current,
                  periodLabel: event.target.value,
                }))
              }}
              placeholder="2026/2027"
            />
            {structure && structure.businessUnits.length > 0 ? (
              <Select
                label="Unidade de negócio"
                value={draft.businessUnitId}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    businessUnitId: event.target.value,
                  }))
                }
                hint="Opcional. Usada como padrão ao adicionar itens."
              >
                <option value="">Toda a empresa</option>
                {structure.businessUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </Select>
            ) : null}
            <Input
              label="Data inicial"
              type="date"
              value={draft.startDate}
              onChange={(event) => applyDates(event.target.value, draft.endDate)}
            />
            <Input
              label="Data final"
              type="date"
              value={draft.endDate}
              onChange={(event) => applyDates(draft.startDate, event.target.value)}
            />
          </div>

          <div className="mt-4">
            <Textarea
              label="Observações"
              value={draft.notes}
              onChange={(event) =>
                setDraft((current) => ({ ...current, notes: event.target.value }))
              }
              placeholder="Premissas, premissas de reajuste, recortes da empresa..."
            />
          </div>

          {metaErrors.length > 0 ? (
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-danger">
              {metaErrors.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}

          <div className="mt-6 flex justify-end gap-2">
            <Link to={isEdit && id ? `/app/orcamentos/${id}` : '/app/orcamentos'}>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </Link>
            <Button type="button" onClick={goToItems}>
              Continuar
            </Button>
          </div>
        </section>
      ) : null}

      {step === 2 && structure ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-ink">
                Estrutura e valores
              </h2>
              <p className="mt-1 text-sm text-mist">
                Unidade → departamento → centro de custo → atividade → conta
                contábil → valor por mês.
              </p>
            </div>
            <Button type="button" onClick={openNewItem}>
              + Adicionar item
            </Button>
          </div>

          {editor ? (
            <BudgetItemEditor
              structure={structure}
              months={months}
              item={editor}
              title={editorMode === 'edit' ? 'Editar item' : 'Novo item'}
              submitLabel={editorMode === 'edit' ? 'Salvar item' : 'Adicionar item'}
              errors={editorErrors}
              onChange={setEditor}
              onSubmit={submitEditor}
              onCancel={() => {
                setEditor(null)
                setEditorErrors([])
              }}
            />
          ) : null}

          <BudgetItemsTable
            items={draft.items}
            months={months}
            labels={labels}
            onEdit={openEditItem}
            onDuplicate={openDuplicateItem}
            onDelete={setPendingDeleteId}
          />

          <div className="flex flex-wrap justify-between gap-2">
            <Button type="button" variant="secondary" onClick={() => setStep(1)}>
              Voltar
            </Button>
            <Button type="button" onClick={() => setStep(3)}>
              Revisar
            </Button>
          </div>
        </section>
      ) : null}

      {step === 3 && structure ? (
        <section className="flex flex-col gap-4">
          <div className="rounded-2xl border border-paper-muted bg-white p-6">
            <h2 className="font-display text-xl font-semibold text-ink">Revisão</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-mist">Nome</dt>
                <dd className="font-medium text-ink">{draft.name}</dd>
              </div>
              <div>
                <dt className="text-mist">Período</dt>
                <dd className="font-medium text-ink">
                  {draft.periodLabel} · {draft.startDate} a {draft.endDate}
                </dd>
              </div>
              <div>
                <dt className="text-mist">Unidade</dt>
                <dd className="font-medium text-ink">
                  {draft.businessUnitId
                    ? labels.businessUnit(draft.businessUnitId)
                    : 'Toda a empresa'}
                </dd>
              </div>
              <div>
                <dt className="text-mist">Itens</dt>
                <dd className="font-medium text-ink">{draft.items.length}</dd>
              </div>
            </dl>
            {draft.notes ? (
              <p className="mt-4 text-sm text-ink-soft/80">{draft.notes}</p>
            ) : null}
          </div>

          {draft.items.length === 0 ? (
            <p className="rounded-xl border border-paper-muted bg-white px-4 py-3 text-sm text-mist">
              Este orçamento ainda não tem itens. Você pode salvar assim mesmo e
              completar depois.
            </p>
          ) : null}

          <BudgetItemsTable items={draft.items} months={months} labels={labels} readOnly />

          <div className="flex flex-wrap justify-between gap-2">
            <Button type="button" variant="secondary" onClick={() => setStep(2)}>
              Voltar
            </Button>
            <Button type="button" disabled={saving} onClick={() => void save()}>
              {saving ? 'Salvando...' : 'Salvar orçamento'}
            </Button>
          </div>
        </section>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        title="Excluir linha"
        body="Excluir esta linha do orçamento? Os valores mensais desta combinação serão removidos."
        confirmLabel="Excluir linha"
        danger
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={confirmDeleteItem}
      />
    </div>
  )
}
