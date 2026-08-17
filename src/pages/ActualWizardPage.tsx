import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useCompany } from '@/features/company/useCompany'
import {
  loadCompanyStructure,
  type CompanyStructure,
} from '@/features/company/structureService'
import {
  getCompanyActual,
  getCompanyActualByBudget,
  saveCompanyActual,
} from '@/features/actual/actualService'
import {
  alignActualToBudget,
  draftFromBudget,
  toDraftActual,
  type DraftActual,
} from '@/features/actual/model'
import { listCompanyBudgets } from '@/features/budget/budgetService'
import type { DraftBudgetItem, LoadedBudget } from '@/features/budget/model'
import {
  duplicateItem,
  emptyAmounts,
  remapAmounts,
  createEmptyItem,
} from '@/features/budget/model'
import { defaultActualName, monthsBetween } from '@/features/budget/period'
import {
  findDuplicateStructure,
  validateBudgetForSave,
  validateBudgetItem,
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

const STEPS = [
  { id: 1, label: 'Vínculo' },
  { id: 2, label: 'Valores' },
  { id: 3, label: 'Revisar' },
]

function emptyDraft(): DraftActual {
  return {
    budgetId: '',
    name: '',
    fiscalYear: new Date().getFullYear(),
    periodLabel: '',
    periodKind: 'calendar_year',
    startDate: '',
    endDate: '',
    businessUnitId: '',
    notes: '',
    status: 'draft',
    items: [],
  }
}

export function ActualWizardPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { company, loading: companyLoading } = useCompany()

  const [step, setStep] = useState(1)
  const [draft, setDraft] = useState<DraftActual>(emptyDraft)
  const [budgets, setBudgets] = useState<LoadedBudget[]>([])
  const [selectedBudget, setSelectedBudget] = useState<LoadedBudget | null>(null)
  const [structure, setStructure] = useState<CompanyStructure | null>(null)
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [metaErrors, setMetaErrors] = useState<string[]>([])
  const [editor, setEditor] = useState<DraftBudgetItem | null>(null)
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create')
  const [editorErrors, setEditorErrors] = useState<string[]>([])
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const requestedBudgetId = params.get('orcamento') || ''
  const fetchKey = company ? `${company.id}:${id ?? 'new'}:${requestedBudgetId}` : null

  useEffect(() => {
    if (!company) return
    const companyId = company.id
    const key = `${companyId}:${id ?? 'new'}:${requestedBudgetId}`
    let mounted = true

    const load = async () => {
      const [nextStructure, nextBudgets] = await Promise.all([
        loadCompanyStructure(companyId),
        listCompanyBudgets(companyId),
      ])
      if (!mounted) return
      setStructure(nextStructure)
      setBudgets(nextBudgets)

      if (id) {
        const actual = await getCompanyActual(companyId, id)
        if (!mounted) return
        if (!actual) {
          setError('Realizado não encontrado nesta empresa.')
          setFetchedFor(key)
          return
        }
        const budget = nextBudgets.find((item) => item.id === actual.budgetId) ?? null
        const nextDraft = toDraftActual(actual)
        if (budget) {
          const aligned = alignActualToBudget(
            nextDraft,
            budget,
            monthsBetween(budget.startDate, budget.endDate)
          )
          setDraft(aligned)
          setSelectedBudget(budget)
        } else {
          setDraft(nextDraft)
          setSelectedBudget(null)
        }
        setError('')
      } else {
        const preferred =
          nextBudgets.find((item) => item.id === requestedBudgetId) ??
          nextBudgets[0] ??
          null
        if (preferred) {
          const existing = await getCompanyActualByBudget(companyId, preferred.id)
          if (!mounted) return
          if (existing) {
            navigate(`/app/realizado/${existing.id}/editar`, { replace: true })
            return
          }
          applyBudget(preferred, emptyDraft())
        } else {
          setDraft(emptyDraft())
          setSelectedBudget(null)
        }
        setError('')
      }
      setFetchedFor(key)
    }

    void load().catch((err: unknown) => {
      if (!mounted) return
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o realizado.')
      setFetchedFor(key)
    })

    return () => {
      mounted = false
    }
  }, [company, id, requestedBudgetId, navigate])

  const loading = Boolean(fetchKey) && fetchedFor !== fetchKey

  const months = useMemo(
    () =>
      draft.startDate && draft.endDate
        ? monthsBetween(draft.startDate, draft.endDate)
        : [],
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
    }
  }, [structure])

  function applyBudget(budget: LoadedBudget, current: DraftActual) {
    const nextMonths = monthsBetween(budget.startDate, budget.endDate)
    const name =
      current.name.trim() && current.budgetId === budget.id
        ? current.name
        : defaultActualName(budget.fiscalYear)
    setSelectedBudget(budget)
    if (current.budgetId === budget.id && current.items.length > 0) {
      setDraft(alignActualToBudget({ ...current, name }, budget, nextMonths))
      return
    }
    setDraft(draftFromBudget(budget, nextMonths, name))
  }

  const chooseBudget = async (budgetId: string) => {
    if (!company) return
    const budget = budgets.find((item) => item.id === budgetId)
    if (!budget) return
    if (!isEdit) {
      const existing = await getCompanyActualByBudget(company.id, budgetId)
      if (existing) {
        navigate(`/app/realizado/${existing.id}/editar`, { replace: true })
        return
      }
    }
    applyBudget(budget, draft)
  }

  const goToItems = () => {
    const errors: string[] = []
    if (!draft.budgetId) errors.push('Vincule o realizado a um orçamento.')
    if (!draft.name.trim()) errors.push('Informe o nome do realizado.')
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
        'Já existe uma linha com esta combinação de unidade, departamento e centro de custo neste realizado.'
      )
    }
    setEditorErrors(errors)
    if (errors.length > 0) return

    setDraft((current) => {
      if (editorMode === 'edit') {
        return {
          ...current,
          items: current.items.map((item) =>
            item.localId === editor.localId
              ? { ...editor, amounts: remapAmounts(editor.amounts, months) }
              : item
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
    if (!draft.budgetId) {
      setError('Vincule o realizado a um orçamento.')
      setStep(1)
      return
    }
    const errors = validateBudgetForSave(draft, structure)
    if (errors.length > 0) {
      setError(errors[0])
      setMetaErrors(errors)
      return
    }

    setSaving(true)
    setError('')
    try {
      const actualId = await saveCompanyActual(company.id, {
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
      navigate(`/app/realizado/${actualId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o realizado.')
    } finally {
      setSaving(false)
    }
  }

  if (!companyLoading && !company) {
    return (
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">Novo realizado</h1>
        <div className="mt-6">
          <CompanyRequired />
        </div>
      </div>
    )
  }

  if (loading) {
    return <p className="text-sm text-mist">Carregando realizado...</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-mist">
            {isEdit ? 'Editar realizado' : 'Novo realizado'}
          </p>
          <h1 className="font-display text-3xl font-bold text-ink">
            {isEdit ? 'Atualizar realizado' : 'Lançar realizado'}
          </h1>
        </div>
        <WizardSteps current={step} steps={STEPS} />
      </div>

      {draft.budgetId ? (
        <BudgetSummaryBar
          draft={draft}
          months={months}
          companyName={company?.trade_name || company?.name}
          fallbackName="Novo realizado"
          totalLabel="Total realizado"
        />
      ) : null}

      {error ? (
        <p className="rounded-xl border border-danger/20 bg-white px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {step === 1 ? (
        <section className="rounded-2xl border border-paper-muted bg-white p-6">
          <h2 className="font-display text-xl font-semibold text-ink">
            Vincular ao orçamento
          </h2>
          <p className="mt-1 text-sm text-mist">
            O realizado usa a mesma estrutura e o mesmo período do orçamento. Esse
            vínculo alimenta a apresentação Orçado × Realizado.
          </p>

          {budgets.length === 0 ? (
            <div className="mt-6 rounded-xl bg-paper px-4 py-4 text-sm text-ink-soft">
              <p>Crie um orçamento antes de lançar o realizado.</p>
              <Link to="/app/orcamentos/novo" className="mt-3 inline-flex">
                <Button>Criar orçamento</Button>
              </Link>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Select
                label="Orçamento"
                value={draft.budgetId}
                disabled={isEdit}
                onChange={(event) => void chooseBudget(event.target.value)}
              >
                <option value="">Selecione um orçamento</option>
                {budgets.map((budget) => (
                  <option key={budget.id} value={budget.id}>
                    {budget.name}
                  </option>
                ))}
              </Select>
              <Input
                label="Nome do realizado"
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
                required
              />
              <Input
                label="Período"
                value={
                  selectedBudget
                    ? `${selectedBudget.periodLabel} · ${selectedBudget.startDate} a ${selectedBudget.endDate}`
                    : 'Selecione um orçamento'
                }
                disabled
              />
            </div>
          )}

          <div className="mt-4">
            <Textarea
              label="Observações"
              value={draft.notes}
              onChange={(event) =>
                setDraft((current) => ({ ...current, notes: event.target.value }))
              }
              placeholder="Premissas do lançamento, recortes, ajustes..."
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
            <Link to={isEdit && id ? `/app/realizado/${id}` : '/app/realizado'}>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </Link>
            <Button type="button" onClick={goToItems} disabled={budgets.length === 0}>
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
                Valores realizados
              </h2>
              <p className="mt-1 text-sm text-mist">
                As linhas vêm do orçamento vinculado. Preencha o que aconteceu em
                cada mês.
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
            emptyMessage="Nenhum item neste realizado. Clique em “+ Adicionar item” para começar."
            totalLabel="Total do realizado"
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
                <dt className="text-mist">Orçamento vinculado</dt>
                <dd className="font-medium text-ink">
                  {selectedBudget?.name || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-mist">Período</dt>
                <dd className="font-medium text-ink">
                  {draft.periodLabel} · {draft.startDate} a {draft.endDate}
                </dd>
              </div>
              <div>
                <dt className="text-mist">Itens</dt>
                <dd className="font-medium text-ink">{draft.items.length}</dd>
              </div>
            </dl>
          </div>

          <BudgetItemsTable
            items={draft.items}
            months={months}
            labels={labels}
            readOnly
            emptyMessage="Este realizado ainda não tem itens."
            totalLabel="Total do realizado"
          />

          <div className="flex flex-wrap justify-between gap-2">
            <Button type="button" variant="secondary" onClick={() => setStep(2)}>
              Voltar
            </Button>
            <Button type="button" disabled={saving} onClick={() => void save()}>
              {saving ? 'Salvando...' : 'Salvar realizado'}
            </Button>
          </div>
        </section>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        title="Excluir linha"
        body="Excluir esta linha do realizado? Os valores mensais desta combinação serão removidos."
        confirmLabel="Excluir linha"
        danger
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={confirmDeleteItem}
      />
    </div>
  )
}
