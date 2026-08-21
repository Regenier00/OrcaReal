import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCompany } from '@/features/company/useCompany'
import {
  getCompanyBudget,
  saveCompanyBudget,
  toDraft,
} from '@/features/budget/budgetService'
import type { DraftBudget, DraftBudgetItem, MoneyGroup } from '@/features/budget/model'
import {
  createDestinationItem,
  emptyGroupTotals,
  groupItems,
  groupRemaining,
  MONEY_GROUP_LABEL,
  MONEY_GROUPS,
  remapAmounts,
} from '@/features/budget/model'
import {
  suggestBudgetDestinations,
  type BudgetDestinationContext,
} from '@/features/budget/defaultDestinations'
import {
  calendarYearBounds,
  currentFiscalYear,
  defaultBudgetName,
  inferPeriodKind,
  monthsBetween,
  periodLabelForYear,
} from '@/features/budget/period'
import {
  validateBudgetForSave,
  validateBudgetMeta,
  validateGroupDestinations,
  validateGroupTotals,
} from '@/features/budget/validation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { CompanyRequired } from '@/components/company/CompanyRequired'
import { WizardSteps } from '@/components/budget/WizardSteps'
import { BudgetSummaryBar } from '@/components/budget/BudgetSummaryBar'
import {
  DestinationEditor,
  DestinationReview,
  GroupTotalsStep,
} from '@/components/budget/DestinationWizard'
import { formatMoney } from '@/features/budget/money'
import { listCompanyOperations } from '@/features/experience/experienceService'
import { companyHasCostCenters } from '@/features/company/costCenterGate'
import { CostCentersRequired } from '@/components/company/CostCentersRequired'

const WIZARD_STEPS = [
  { id: 1, label: 'Período' },
  { id: 2, label: 'Grupos' },
  { id: 3, label: 'Destinos' },
  { id: 4, label: 'Revisar' },
] as const

function uniqueCodes(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const key = value.trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(key)
  }
  return result
}

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
    groupTotals: emptyGroupTotals(),
    items: [],
  }
}

function buildSuggestedItems(
  context: BudgetDestinationContext,
  months: ReturnType<typeof monthsBetween>
): DraftBudgetItem[] {
  const suggestions = suggestBudgetDestinations(context)
  return MONEY_GROUPS.flatMap((group) =>
    suggestions[group.id].map((name) =>
      createDestinationItem(months, group.id, name, 0)
    )
  )
}

function withSuggestedDestinations(
  draft: DraftBudget,
  context: BudgetDestinationContext,
  onlyEmptyGroups = false
): DraftBudget {
  const months = monthsBetween(draft.startDate, draft.endDate)
  const suggested = buildSuggestedItems(context, months)
  if (!onlyEmptyGroups && draft.items.length === 0) {
    return { ...draft, items: suggested }
  }

  const nextItems = [...draft.items]
  for (const group of MONEY_GROUPS) {
    if (groupItems(draft.items, group.id).length > 0) continue
    nextItems.push(...suggested.filter((item) => item.moneyGroup === group.id))
  }
  return { ...draft, items: nextItems }
}

export function BudgetWizardPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const {
    company,
    companyProfile,
    segments,
    loading: companyLoading,
  } = useCompany()

  const [step, setStep] = useState(1)
  const [draft, setDraft] = useState<DraftBudget>(createDraft)
  const [nameTouched, setNameTouched] = useState(isEdit)
  const [labelTouched, setLabelTouched] = useState(isEdit)
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [metaErrors, setMetaErrors] = useState<string[]>([])
  const [groupErrors, setGroupErrors] = useState<string[]>([])
  const [destinationErrors, setDestinationErrors] = useState<string[]>([])
  const [activeGroupIndex, setActiveGroupIndex] = useState(0)
  const [suggestionsSeeded, setSuggestionsSeeded] = useState(false)
  const [hasCostCenters, setHasCostCenters] = useState<boolean | null>(isEdit ? true : null)
  const fetchKey = company ? `${company.id}:${id ?? 'new'}` : null

  const destinationContext = useMemo<BudgetDestinationContext>(() => {
    const segment = segments.find((item) => item.id === companyProfile?.segment_id)
    const facts = companyProfile?.profile_facts ?? {}
    const operations = Array.isArray(facts.operations)
      ? facts.operations.map(String)
      : []
    return {
      segmentCode: segment?.code ?? null,
      extraSegmentCodes: operations,
      revenueModel: companyProfile?.revenue_model ?? null,
      operationModel: companyProfile?.operation_model ?? null,
      primaryActivity: companyProfile?.primary_activity ?? null,
      customSegment: companyProfile?.custom_segment ?? null,
      employeeCount: companyProfile?.employee_count ?? null,
      profileFacts: facts,
    }
  }, [companyProfile, segments])

  useEffect(() => {
    if (!company || companyLoading) return
    const companyId = company.id
    const key = `${companyId}:${id ?? 'new'}`
    let mounted = true

    const load = async () => {
      if (!id) {
        const centersReady = await companyHasCostCenters(companyId)
        if (!mounted) return
        setHasCostCenters(centersReady)
        if (!centersReady) {
          setFetchedFor(key)
          setSuggestionsSeeded(true)
          setError('')
          return
        }
      } else {
        setHasCostCenters(true)
      }

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
        setSuggestionsSeeded(true)
        setError('')
        setFetchedFor(key)
        return
      }

      if (suggestionsSeeded && fetchedFor === key) return

      const operationsResult = await listCompanyOperations(companyId)
      if (!mounted) return
      const extraCodes =
        operationsResult.ok
          ? operationsResult.data
              .filter((row) => row.is_primary !== true)
              .map((row) => {
                const segmentId = typeof row.segment_id === 'string' ? row.segment_id : null
                return segments.find((item) => item.id === segmentId)?.code
              })
              .filter((code): code is string => Boolean(code))
          : []

      const context: BudgetDestinationContext = {
        ...destinationContext,
        extraSegmentCodes: uniqueCodes([
          ...(destinationContext.extraSegmentCodes ?? []),
          ...extraCodes,
        ]),
      }

      setDraft(withSuggestedDestinations(createDraft(), context))
      setSuggestionsSeeded(true)
      setError('')
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
  }, [
    company,
    companyLoading,
    id,
    destinationContext,
    segments,
    suggestionsSeeded,
    fetchedFor,
  ])

  const loading = Boolean(fetchKey) && fetchedFor !== fetchKey

  const months = useMemo(
    () => monthsBetween(draft.startDate, draft.endDate),
    [draft.startDate, draft.endDate]
  )

  const activeGroups = useMemo(
    () =>
      draft.groupTotals
        .filter((group) => group.total > 0)
        .map((group) => group.moneyGroup),
    [draft.groupTotals]
  )

  const currentGroup: MoneyGroup | null =
    activeGroups[Math.min(activeGroupIndex, Math.max(activeGroups.length - 1, 0))] ??
    null

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
        amounts: remapAmounts(
          item.amounts,
          monthsBetween(bounds.startDate, bounds.endDate)
        ),
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

  const goToGroups = () => {
    const errors = validateBudgetMeta(draft)
    setMetaErrors(errors)
    if (errors.length > 0) return
    setStep(2)
  }

  const goToDestinations = () => {
    const errors = validateGroupTotals(draft)
    setGroupErrors(errors)
    if (errors.length > 0) return
    setDraft((current) =>
      withSuggestedDestinations(current, destinationContext, true)
    )
    setActiveGroupIndex(0)
    setDestinationErrors([])
    setStep(3)
  }

  const goToNextGroupOrReview = () => {
    if (!currentGroup) {
      setStep(4)
      return
    }
    const errors = validateGroupDestinations(draft, currentGroup)
    setDestinationErrors(errors)
    if (errors.length > 0) return

    if (activeGroupIndex < activeGroups.length - 1) {
      setActiveGroupIndex((index) => index + 1)
      setDestinationErrors([])
      return
    }
    setStep(4)
  }

  const goBackFromDestinations = () => {
    if (activeGroupIndex > 0) {
      setActiveGroupIndex((index) => index - 1)
      setDestinationErrors([])
      return
    }
    setStep(2)
  }

  const save = async () => {
    if (!company) return
    const errors = validateBudgetForSave(draft)
    if (errors.length > 0) {
      setError(errors[0])
      setMetaErrors(errors)
      if (validateBudgetMeta(draft).length > 0) setStep(1)
      else if (validateGroupTotals(draft).length > 0) setStep(2)
      else setStep(3)
      return
    }

    setSaving(true)
    setError('')
    try {
      const budgetId = await saveCompanyBudget(company.id, draft)
      navigate(`/app/orcamentos/${budgetId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o orçamento.')
    } finally {
      setSaving(false)
    }
  }

  const cancelTo = isEdit && id ? `/app/orcamentos/${id}` : '/app/orcamentos'

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

  if (loading || (!isEdit && !suggestionsSeeded)) {
    return <p className="text-sm text-mist">Carregando orçamento...</p>
  }

  if (!isEdit && hasCostCenters === false) {
    return (
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">Novo orçamento</h1>
        <p className="mt-2 max-w-xl text-sm text-mist">
          O orçamento precisa de centros de custo para ter destino.
        </p>
        <div className="mt-6">
          <CostCentersRequired />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-mist">
            {isEdit ? 'Editar orçamento' : 'Novo orçamento'}
          </p>
          <h1 className="font-display text-3xl font-bold text-ink">
            {isEdit ? 'Atualizar orçamento' : 'Criar novo orçamento'}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-mist">
            Pense primeiro em quanto dinheiro você tem e para onde quer destiná-lo.
            O sistema organiza a estrutura e os indicadores.
          </p>
        </div>
        <WizardSteps current={step} steps={WIZARD_STEPS} />
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
            Definir período
          </h2>
          <p className="mt-1 text-sm text-mist">
            Escolha o intervalo do orçamento. O padrão é janeiro a dezembro do ano
            informado.
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
            <div className="hidden md:block" />
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
              placeholder="Premissas, recortes da empresa..."
            />
          </div>

          {metaErrors.length > 0 ? (
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-danger">
              {metaErrors.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}

          <div className="mt-6 flex flex-wrap justify-between gap-2">
            <Link to={cancelTo}>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </Link>
            <Button type="button" onClick={goToGroups}>
              Continuar
            </Button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-4">
          <GroupTotalsStep
            draft={draft}
            onChangeTotal={(moneyGroup, total) =>
              setDraft((current) => {
                const nextTotals = current.groupTotals.map((group) =>
                  group.moneyGroup === moneyGroup ? { ...group, total } : group
                )
                if (total <= 0) {
                  return {
                    ...current,
                    groupTotals: nextTotals,
                    items: current.items.filter(
                      (item) => item.moneyGroup !== moneyGroup
                    ),
                  }
                }
                const hasGroupItems =
                  groupItems(current.items, moneyGroup).length > 0
                if (hasGroupItems) {
                  return { ...current, groupTotals: nextTotals }
                }
                return withSuggestedDestinations(
                  { ...current, groupTotals: nextTotals },
                  destinationContext,
                  true
                )
              })
            }
          />

          {groupErrors.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-danger">
              {groupErrors.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Link to={cancelTo}>
                <Button type="button" variant="secondary">
                  Cancelar
                </Button>
              </Link>
            </div>
            <Button type="button" onClick={goToDestinations}>
              Continuar para destinos
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 && currentGroup ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {activeGroups.map((group, index) => (
              <button
                key={group}
                type="button"
                onClick={() => {
                  setActiveGroupIndex(index)
                  setDestinationErrors([])
                }}
                className={
                  group === currentGroup
                    ? 'rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white'
                    : 'rounded-full bg-paper-muted px-3 py-1.5 text-xs font-medium text-mist'
                }
              >
                {index + 1}. {MONEY_GROUP_LABEL[group]}
                {groupRemaining(draft, group, months) === 0 ? ' ✓' : ''}
              </button>
            ))}
          </div>

          <DestinationEditor
            draft={draft}
            months={months}
            moneyGroup={currentGroup}
            onChangeItems={(items) => setDraft((current) => ({ ...current, items }))}
          />

          {destinationErrors.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-danger">
              {destinationErrors.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={goBackFromDestinations}>
                Voltar
              </Button>
              <Link to={cancelTo}>
                <Button type="button" variant="secondary">
                  Cancelar
                </Button>
              </Link>
            </div>
            <Button type="button" onClick={goToNextGroupOrReview}>
              {activeGroupIndex < activeGroups.length - 1
                ? `Continuar · ${MONEY_GROUP_LABEL[activeGroups[activeGroupIndex + 1]]}`
                : 'Revisar'}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
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
                <dt className="text-mist">Destinos</dt>
                <dd className="font-medium text-ink">{draft.items.length}</dd>
              </div>
              <div>
                <dt className="text-mist">Total orçado</dt>
                <dd className="font-medium text-ink">
                  {formatMoney(
                    draft.groupTotals.reduce((total, group) => total + group.total, 0)
                  )}
                </dd>
              </div>
            </dl>
            {draft.notes ? (
              <p className="mt-4 text-sm text-ink-soft/80">{draft.notes}</p>
            ) : null}
          </div>

          <DestinationReview draft={draft} months={months} />

          <div className="flex flex-wrap justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setActiveGroupIndex(Math.max(activeGroups.length - 1, 0))
                  setStep(3)
                }}
              >
                Voltar
              </Button>
              <Link to={cancelTo}>
                <Button type="button" variant="secondary">
                  Cancelar
                </Button>
              </Link>
            </div>
            <Button type="button" disabled={saving} onClick={() => void save()}>
              {saving ? 'Salvando...' : 'Salvar orçamento'}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
