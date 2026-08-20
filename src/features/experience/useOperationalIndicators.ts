import { useEffect, useMemo, useState } from 'react'
import { useCompany } from '@/features/company/useCompany'
import { getCompanyExperienceAnswers } from '@/features/experience/experienceService'
import {
  OPERATION_PRIORITIES_QUESTION,
  findOperationalIndicator,
  operationModelFromValue,
  operationalIndicatorsFor,
  selectedOperationPriorities,
  type OperationModelDef,
  type OperationModelId,
  type OperationalIndicatorSeed,
} from '@/features/experience/catalog/operationModels'
import {
  listOperationInputs,
  saveOperationInputs,
  type MonthlyNamedInputs,
} from '@/features/experience/operationalInputs'
import { parseEmployeeCount } from '@/features/experience/employeeCount'
import { defaultUnitCostMonth } from '@/features/experience/unitCost'
import { listCompanyComparisonOptions, loadComparisonPair } from '@/features/comparison/comparisonService'
import { listClassifiedActualSlices } from '@/features/actual/actualService'
import { calendarYearBounds, currentFiscalYear, monthsBetween } from '@/features/budget/period'
import type { BudgetMonth } from '@/features/budget/period'
import type { ClassifiedActualSlice, LoadedActual } from '@/features/actual/model'
import { previousMonth } from '@/features/home/dashboardModel'
import { changeRatio } from '@/features/home/dashboardModel'
import { buildActualTotals } from '@/features/indicators/formula'
import {
  evaluateOperationalFormula,
  type OperationalFormulaContext,
} from '@/features/indicators/operationalFormula'
import { evaluateBreakdown } from '@/features/indicators/operationalDisplay'
import type { ComparisonMonthKey } from '@/features/comparison/model'

export interface OperationalCardModel {
  def: OperationalIndicatorSeed
  model: OperationModelDef
  monthKey: string
  monthLabel: string
  value: number | null
  previousValue: number | null
  change: number | null
  context: OperationalFormulaContext
  breakdown: Array<{ label: string; value: number }>
  inputs: Record<string, number>
}

export function useOperationalIndicators(input?: {
  months?: BudgetMonth[]
  preferredMonth?: ComparisonMonthKey | string | null
  actual?: LoadedActual | null
  classified?: ClassifiedActualSlice[]
}) {
  const { activeCompany, companyProfile } = useCompany()
  const [model, setModel] = useState<OperationModelDef | null>(null)
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])
  const [namedInputs, setNamedInputs] = useState<MonthlyNamedInputs>({})
  const [fetchedMonths, setFetchedMonths] = useState<BudgetMonth[]>([])
  const [fetchedActual, setFetchedActual] = useState<LoadedActual | null>(null)
  const [fetchedClassified, setFetchedClassified] = useState<ClassifiedActualSlice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingCode, setSavingCode] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const providedRealized = input?.actual !== undefined || input?.classified !== undefined
  const months = input?.months ?? fetchedMonths
  const actual = input?.actual !== undefined ? input.actual : fetchedActual
  const classified =
    input?.classified !== undefined ? input.classified : fetchedClassified

  const reload = () => setReloadKey((value) => value + 1)

  useEffect(() => {
    if (!activeCompany) return
    let mounted = true

    void (async () => {
      setLoading(true)
      const [answers, budgets] = await Promise.all([
        getCompanyExperienceAnswers(activeCompany.id),
        providedRealized
          ? Promise.resolve([])
          : listCompanyComparisonOptions(activeCompany.id).catch(() => []),
      ])
      if (!mounted) return

      const modelValue = answers.ok
        ? String(answers.data.operation_model ?? companyProfile?.operation_model ?? '')
        : (companyProfile?.operation_model ?? '')
      const nextModel = operationModelFromValue(modelValue)
      const codes = selectedOperationPriorities(
        answers.ok ? answers.data[OPERATION_PRIORITIES_QUESTION] : []
      )
      setModel(nextModel)
      setSelectedCodes(codes)

      if (nextModel) {
        const stored = await listOperationInputs(activeCompany.id, [nextModel.id])
        if (!mounted) return
        if (stored.ok) setNamedInputs(stored.data[nextModel.id] ?? {})
        else setError(stored.message)
      } else {
        setNamedInputs({})
      }

      if (!providedRealized) {
        const activeBudget =
          (Array.isArray(budgets) ? budgets : []).find((item) => item.status === 'active') ??
          (Array.isArray(budgets) ? budgets[0] : null)
        if (activeBudget) {
          const pair = await loadComparisonPair(activeCompany.id, activeBudget.id).catch(() => null)
          if (!mounted) return
          setFetchedMonths(monthsBetween(activeBudget.startDate, activeBudget.endDate))
          setFetchedActual(pair?.actual ?? null)
          setFetchedClassified(pair?.classifiedActuals ?? [])
        } else {
          const year = currentFiscalYear()
          const bounds = calendarYearBounds(year)
          const slices = await listClassifiedActualSlices(
            activeCompany.id,
            bounds.startDate,
            bounds.endDate
          ).catch(() => [])
          if (!mounted) return
          setFetchedMonths(monthsBetween(bounds.startDate, bounds.endDate))
          setFetchedActual(null)
          setFetchedClassified(slices)
        }
      }

      setLoading(false)
    })()

    return () => {
      mounted = false
    }
  }, [activeCompany, companyProfile, providedRealized, reloadKey])

  const periodKey = useMemo<ComparisonMonthKey>(() => {
    const preferred = input?.preferredMonth
    if (preferred === 'all') return 'all'
    if (preferred && months.some((item) => item.key === preferred)) return preferred
    return defaultUnitCostMonth(months, preferred) ?? months[months.length - 1]?.key ?? 'all'
  }, [months, input?.preferredMonth])

  const isConsolidated = periodKey === 'all'

  const monthKey = useMemo(() => {
    if (isConsolidated) {
      return defaultUnitCostMonth(months) ?? months[months.length - 1]?.key ?? ''
    }
    return periodKey
  }, [months, isConsolidated, periodKey])

  const totals = useMemo(
    () => buildActualTotals(months, actual, classified),
    [months, actual, classified]
  )
  const previous = useMemo(() => previousMonth(months, monthKey), [months, monthKey])
  const employeeCount = parseEmployeeCount(companyProfile?.employee_count)

  const defs = useMemo(
    () => (model ? operationalIndicatorsFor(model.value, selectedCodes) : []),
    [model, selectedCodes]
  )

  const cards = useMemo<OperationalCardModel[]>(() => {
    if (!model) return []
    const month = months.find((item) => item.key === monthKey)
    const period = isConsolidated
      ? totals.consolidated
      : (totals.byMonth[monthKey] ?? { revenue: 0, cost: 0, expense: 0 })
    const previousPeriod =
      !isConsolidated && previous
        ? (totals.byMonth[previous.key] ?? { revenue: 0, cost: 0, expense: 0 })
        : null
    const monthInputs = namedInputs[monthKey] ?? {}

    return defs.map((def) => {
      const context: OperationalFormulaContext = {
        revenue: period.revenue,
        cost: period.cost,
        expense: period.expense,
        previousRevenue: previousPeriod?.revenue ?? null,
        employeeCount,
        inputs: monthInputs,
      }
      const previousContext: OperationalFormulaContext | null = previousPeriod
        ? {
            revenue: previousPeriod.revenue,
            cost: previousPeriod.cost,
            expense: previousPeriod.expense,
            previousRevenue: null,
            employeeCount,
            inputs: namedInputs[previous?.key ?? ''] ?? {},
          }
        : null

      const value = evaluateOperationalFormula(def.formula, context)
      const previousValue = previousContext
        ? evaluateOperationalFormula(def.formula, previousContext)
        : null

      return {
        def,
        model,
        monthKey,
        monthLabel: isConsolidated ? 'Período completo' : (month?.fullLabel ?? monthKey),
        value,
        previousValue,
        change: isConsolidated ? null : changeRatio(value ?? Number.NaN, previousValue),
        context,
        breakdown: def.breakdown ? evaluateBreakdown(def.breakdown, context) : [],
        inputs: monthInputs,
      }
    })
  }, [model, defs, months, monthKey, isConsolidated, totals, previous, namedInputs, employeeCount])

  const saveInputs = async (
    indicatorCode: string,
    values: Record<string, number>,
    month: string
  ) => {
    if (!activeCompany || !model) {
      return { ok: false as const, message: 'Empresa não encontrada.' }
    }
    const indicator = findOperationalIndicator(indicatorCode)
    if (!indicator) return { ok: false as const, message: 'Indicador não encontrado.' }
    setSavingCode(indicatorCode)
    const saved = await saveOperationInputs({
      companyId: activeCompany.id,
      modelId: model.id as OperationModelId,
      monthKey: month,
      values,
      current: namedInputs,
    })
    setSavingCode('')
    if (!saved.ok) {
      setError(saved.message)
      return saved
    }
    setNamedInputs(saved.data)
    return saved
  }

  return {
    model,
    selectedCodes,
    cards,
    months,
    periodKey,
    isConsolidated,
    monthKey,
    monthLabel: isConsolidated
      ? 'Período completo'
      : (months.find((item) => item.key === monthKey)?.fullLabel ?? monthKey),
    loading: Boolean(activeCompany) && loading,
    error,
    savingCode,
    saveInputs,
    reload,
  }
}
