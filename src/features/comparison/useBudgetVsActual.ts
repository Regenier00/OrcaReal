import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCompany } from '@/features/company/useCompany'
import {
  listCompanyComparisonOptions,
  loadBudgetVsActualByMoneyGroup,
  type BudgetVsActualPresentation,
} from '@/features/comparison/comparisonService'
import type { LoadedBudget } from '@/features/budget/model'
import { MONEY_GROUPS } from '@/features/budget/model'
import { monthsBetween, type BudgetMonth } from '@/features/budget/period'
import type { MoneyGroup } from '@/types/database'
import type { ComparisonMonthKey } from '@/features/comparison/model'

const MONEY_GROUP_IDS = new Set(MONEY_GROUPS.map((group) => group.id))

function parseMoneyGroup(value: string | null): MoneyGroup {
  if (value && MONEY_GROUP_IDS.has(value as MoneyGroup)) {
    return value as MoneyGroup
  }
  return 'cost'
}

export function useBudgetVsActualData() {
  const { company, loading: companyLoading } = useCompany()
  const [params, setParams] = useSearchParams()
  const [budgets, setBudgets] = useState<LoadedBudget[]>([])
  const [presentation, setPresentation] = useState<BudgetVsActualPresentation | null>(
    null
  )
  const [listFetchedFor, setListFetchedFor] = useState<string | null>(null)
  const [presentationFetchedFor, setPresentationFetchedFor] = useState<string | null>(
    null
  )
  const [error, setError] = useState('')

  const requestedBudgetId = params.get('orcamento') || ''
  const moneyGroup = parseMoneyGroup(params.get('grupo'))
  const monthParam = params.get('mes')
  const month: ComparisonMonthKey = monthParam || 'all'

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
              if (!next.get('grupo')) next.set('grupo', moneyGroup)
              return next
            },
            { replace: true }
          )
        }
        if (!nextId) {
          setPresentation(null)
          setPresentationFetchedFor(`${companyId}:none`)
        }
      })
      .catch((err: unknown) => {
        if (!mounted) return
        setError(
          err instanceof Error ? err.message : 'Não foi possível carregar os orçamentos.'
        )
        setBudgets([])
        setPresentation(null)
        setListFetchedFor(companyId)
        setPresentationFetchedFor(`${companyId}:error`)
      })

    return () => {
      mounted = false
    }
  }, [company, requestedBudgetId, moneyGroup, setParams])

  useEffect(() => {
    if (!company || !requestedBudgetId) return
    const companyId = company.id
    const budgetId = requestedBudgetId
    const monthKey = month === 'all' ? 'all' : String(month)
    const key = `${companyId}:${budgetId}:${moneyGroup}:${monthKey}`
    let mounted = true

    void loadBudgetVsActualByMoneyGroup({
      companyId,
      budgetId,
      moneyGroup,
      monthKey,
    })
      .then((data) => {
        if (!mounted) return
        setPresentation(data)
        setError('')
        setPresentationFetchedFor(key)
      })
      .catch((err: unknown) => {
        if (!mounted) return
        setError(
          err instanceof Error ? err.message : 'Não foi possível carregar a comparação.'
        )
        setPresentation(null)
        setPresentationFetchedFor(key)
      })

    return () => {
      mounted = false
    }
  }, [company, requestedBudgetId, moneyGroup, month])

  const expectedKey = company
    ? requestedBudgetId
      ? `${company.id}:${requestedBudgetId}:${moneyGroup}:${month === 'all' ? 'all' : month}`
      : `${company.id}:none`
    : null

  const loading =
    companyLoading ||
    (company ? listFetchedFor !== company.id : false) ||
    (expectedKey ? presentationFetchedFor !== expectedKey : false)

  const months: BudgetMonth[] = useMemo(() => {
    if (!presentation?.startDate || !presentation?.endDate) return []
    return monthsBetween(presentation.startDate, presentation.endDate)
  }, [presentation])

  const setBudgetId = (budgetId: string) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.set('orcamento', budgetId)
        return next
      },
      { replace: true }
    )
  }

  const setMoneyGroup = (group: MoneyGroup) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.set('grupo', group)
        return next
      },
      { replace: true }
    )
  }

  const setMonth = (value: ComparisonMonthKey) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value === 'all') next.delete('mes')
        else next.set('mes', value)
        return next
      },
      { replace: true }
    )
  }

  return {
    company,
    companyLoading,
    budgets,
    loading,
    error,
    months,
    month,
    setMonth,
    moneyGroup,
    setMoneyGroup,
    rows: presentation?.rows ?? [],
    summary: presentation?.summary ?? {
      budget: 0,
      actual: 0,
      variance: 0,
      variancePct: Number.NaN,
    },
    setBudgetId,
    selectedBudgetId: requestedBudgetId,
    hasRealized: presentation?.hasRealized ?? false,
    hasClassifiedOrActual: presentation?.hasRealized ?? false,
  }
}
