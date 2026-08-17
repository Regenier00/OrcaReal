import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCompany } from '@/features/company/useCompany'
import {
  listCompanyComparisonOptions,
  loadComparisonPair,
  type ComparisonPair,
} from '@/features/comparison/comparisonService'
import type { LoadedBudget } from '@/features/budget/model'
import { monthsBetween, type BudgetMonth } from '@/features/budget/period'
import {
  applyActualCut,
  buildComparisonLines,
  comparisonRows,
  comparisonTotals,
  costConcentration,
  type ComparisonGroupBy,
  type ComparisonMonthKey,
} from '@/features/comparison/model'

export function useComparisonData() {
  const { company, loading: companyLoading } = useCompany()
  const [params, setParams] = useSearchParams()
  const [budgets, setBudgets] = useState<LoadedBudget[]>([])
  const [pair, setPair] = useState<ComparisonPair | null>(null)
  const [listFetchedFor, setListFetchedFor] = useState<string | null>(null)
  const [pairFetchedFor, setPairFetchedFor] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [month, setMonth] = useState<ComparisonMonthKey>('all')
  const [groupBy, setGroupBy] = useState<ComparisonGroupBy>('line')
  const [cut, setCut] = useState(8)
  const [appliedCut, setAppliedCut] = useState(0)

  const requestedBudgetId = params.get('orcamento') || ''

  useEffect(() => {
    if (!company) return
    const companyId = company.id
    let mounted = true

    void listCompanyComparisonOptions(companyId)
      .then((data) => {
        if (!mounted) return
        setBudgets(data)
        setError('')
        setListFetchedFor(companyId)
        const nextId =
          (requestedBudgetId && data.some((item) => item.id === requestedBudgetId)
            ? requestedBudgetId
            : null) ||
          data[0]?.id ||
          ''
        if (nextId && nextId !== requestedBudgetId) {
          setParams(
            (current) => {
              const next = new URLSearchParams(current)
              next.set('orcamento', nextId)
              return next
            },
            { replace: true }
          )
        }
        if (!nextId) {
          setPair(null)
          setPairFetchedFor(`${companyId}:none`)
        }
      })
      .catch((err: unknown) => {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Não foi possível carregar os orçamentos.')
        setBudgets([])
        setPair(null)
        setListFetchedFor(companyId)
        setPairFetchedFor(`${companyId}:error`)
      })

    return () => {
      mounted = false
    }
  }, [company, requestedBudgetId, setParams])

  useEffect(() => {
    if (!company || !requestedBudgetId) return
    const companyId = company.id
    const budgetId = requestedBudgetId
    const key = `${companyId}:${budgetId}`
    let mounted = true

    void loadComparisonPair(companyId, budgetId)
      .then((data) => {
        if (!mounted) return
        setPair(data)
        setAppliedCut(0)
        setMonth('all')
        setError(data ? '' : 'Orçamento não encontrado nesta empresa.')
        setPairFetchedFor(key)
      })
      .catch((err: unknown) => {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Não foi possível carregar a comparação.')
        setPair(null)
        setPairFetchedFor(key)
      })

    return () => {
      mounted = false
    }
  }, [company, requestedBudgetId])

  const expectedPairKey = company
    ? requestedBudgetId
      ? `${company.id}:${requestedBudgetId}`
      : `${company.id}:none`
    : null

  const loading =
    companyLoading ||
    (company ? listFetchedFor !== company.id : false) ||
    (expectedPairKey ? pairFetchedFor !== expectedPairKey : false)

  const months: BudgetMonth[] = useMemo(
    () =>
      pair?.budget
        ? monthsBetween(pair.budget.startDate, pair.budget.endDate)
        : [],
    [pair]
  )

  const lines = useMemo(() => {
    const base = buildComparisonLines(pair?.budget ?? null, pair?.actual ?? null, months)
    return appliedCut > 0 ? applyActualCut(base, appliedCut) : base
  }, [pair, months, appliedCut])

  const summary = useMemo(
    () => comparisonTotals(lines, months, month),
    [lines, months, month]
  )
  const rows = useMemo(
    () => comparisonRows(lines, months, month, groupBy),
    [lines, months, month, groupBy]
  )
  const concentration = useMemo(
    () => costConcentration(lines, months, month),
    [lines, months, month]
  )

  const setBudgetId = (budgetId: string) => {
    const next = new URLSearchParams(params)
    next.set('orcamento', budgetId)
    setParams(next, { replace: true })
  }

  const applySimulation = () => {
    setAppliedCut(cut)
  }

  const clearSimulation = () => {
    setAppliedCut(0)
  }

  return {
    company,
    companyLoading,
    budgets,
    pair,
    loading,
    error,
    months,
    month,
    setMonth,
    groupBy,
    setGroupBy,
    lines,
    rows,
    summary,
    concentration,
    cut,
    setCut,
    appliedCut,
    applySimulation,
    clearSimulation,
    setBudgetId,
    selectedBudgetId: requestedBudgetId,
  }
}
