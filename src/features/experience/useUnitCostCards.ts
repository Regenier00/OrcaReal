import { useEffect, useMemo, useState } from 'react'
import { useCompany } from '@/features/company/useCompany'
import { isSegmentCode, segmentLabel, type SegmentCode } from '@/features/company/segmentOptions'
import { extraSegmentCodesFromAnswers } from '@/features/experience/conditions'
import { unitCostsForSegments, type SegmentUnitCostDef } from '@/features/experience/catalog/segmentUnits'
import { EMPLOYEE_HEADCOUNT_COSTS, formulaForUnitCost } from '@/features/experience/catalog/employeeHeadcount'
import {
  revenueIndicatorGroupLabel,
  revenueUnitCostsFor,
  selectedRevenueModels,
} from '@/features/experience/catalog/revenueModels'
import { listCompanyOperations, getCompanyExperienceAnswers } from '@/features/experience/experienceService'
import { listUnitVolumes, saveUnitVolume } from '@/features/experience/unitVolumeService'
import {
  defaultUnitCostMonth,
  type MonthlyVolumes,
} from '@/features/experience/unitCost'
import {
  isEmployeeHeadcountIndicator,
  mergeEmployeeVolumes,
  parseEmployeeCount,
} from '@/features/experience/employeeCount'
import { listCompanyComparisonOptions, loadComparisonPair } from '@/features/comparison/comparisonService'
import type { ClassifiedActualSlice, LoadedActual } from '@/features/actual/model'
import type { LoadedBudget } from '@/features/budget/model'
import type { BudgetMonth } from '@/features/budget/period'
import { calendarYearBounds, currentFiscalYear, monthsBetween } from '@/features/budget/period'
import { listClassifiedActualSlices } from '@/features/actual/actualService'
import { listClassifiedErpSlices } from '@/features/erp/erpService'
import {
  buildFinancialSeries,
  changeRatio,
  periodFinancials,
  previousMonth,
} from '@/features/home/dashboardModel'
import type { ComparisonMonthKey } from '@/features/comparison/model'
import {
  buildActualTotals,
  CONSOLIDATED_VOLUME_KEY,
} from '@/features/indicators/formula'
import {
  customIndicatorVolumeCode,
  deleteCompanyCustomIndicator,
  listCompanyCustomIndicators,
  listCompanyCustomUnits,
  parseIndicatorFormula,
} from '@/features/indicators/customIndicatorService'
import { customIndicatorDefFromUnit } from '@/features/indicators/units'
import type { CompanyCustomIndicator, CompanyCustomUnit } from '@/types/database'
import {
  buildUnitCostCard,
  type UnitCostCardModel,
} from '@/features/experience/unitCostCard'

export type { IndicatorCardDef, UnitCostCardModel } from '@/features/experience/unitCostCard'
export { buildUnitCostCard } from '@/features/experience/unitCostCard'

export function useUnitCostCards(input?: {
  months?: BudgetMonth[]
  preferredMonth?: ComparisonMonthKey | string | null
  actual?: LoadedActual | null
  classified?: ClassifiedActualSlice[]
}) {
  const { activeCompany, companyProfile, segments } = useCompany()
  const [defs, setDefs] = useState<SegmentUnitCostDef[]>([])
  const [customIndicators, setCustomIndicators] = useState<CompanyCustomIndicator[]>([])
  const [customUnits, setCustomUnits] = useState<CompanyCustomUnit[]>([])
  const [volumes, setVolumes] = useState<Record<string, MonthlyVolumes>>({})
  const [fetchedMonths, setFetchedMonths] = useState<BudgetMonth[]>([])
  const [fetchedActual, setFetchedActual] = useState<LoadedActual | null>(null)
  const [fetchedBudget, setFetchedBudget] = useState<LoadedBudget | null>(null)
  const [fetchedClassified, setFetchedClassified] = useState<ClassifiedActualSlice[]>(
    []
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingCode, setSavingCode] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const providedRealized = input?.actual !== undefined || input?.classified !== undefined
  const months = input?.months ?? fetchedMonths
  const actual = input?.actual !== undefined ? input.actual : fetchedActual
  const classified =
    input?.classified !== undefined ? input.classified : fetchedClassified

  const reloadCustom = () => setReloadKey((value) => value + 1)

  useEffect(() => {
    if (!activeCompany) return
    let mounted = true

    void (async () => {
      setLoading(true)
      const [ops, answers, budgets, customResult, unitsResult] = await Promise.all([
        listCompanyOperations(activeCompany.id),
        getCompanyExperienceAnswers(activeCompany.id),
        providedRealized ? Promise.resolve([]) : listCompanyComparisonOptions(activeCompany.id).catch(() => []),
        listCompanyCustomIndicators(activeCompany.id),
        listCompanyCustomUnits(activeCompany.id),
      ])
      if (!mounted) return

      const primary = segments.find((item) => item.id === companyProfile?.segment_id)
      const codes = new Set<string>()
      if (primary && isSegmentCode(primary.code)) codes.add(primary.code)
      else codes.add('other')

      if (answers.ok) {
        for (const code of extraSegmentCodesFromAnswers(answers.data)) {
          if (isSegmentCode(code)) codes.add(code)
        }
      }
      if (ops.ok) {
        for (const row of ops.data) {
          const segmentId = String(row.segment_id ?? '')
          const matched = segments.find((item) => item.id === segmentId)
          if (matched && isSegmentCode(matched.code)) codes.add(matched.code)
        }
      }

      const models = selectedRevenueModels(
        answers.ok ? answers.data : {},
        companyProfile?.revenue_model
      )
      const nextDefs = [
        ...unitCostsForSegments([...codes]),
        ...EMPLOYEE_HEADCOUNT_COSTS,
        ...revenueUnitCostsFor(models),
      ]
      setDefs(nextDefs)
      if (customResult.ok) setCustomIndicators(customResult.data)
      else setError(customResult.message)
      if (unitsResult.ok) setCustomUnits(unitsResult.data)

      const volumeCodes = [
        ...nextDefs.map((item) => item.indicatorCode),
        ...(customResult.ok ? customResult.data.map((item) => customIndicatorVolumeCode(item.id)) : []),
      ]
      const volumeResult = await listUnitVolumes(activeCompany.id, volumeCodes)
      if (!mounted) return
      if (volumeResult.ok) setVolumes(volumeResult.data)

      if (!providedRealized) {
        const activeBudget =
          (Array.isArray(budgets) ? budgets : []).find((item) => item.status === 'active') ??
          (Array.isArray(budgets) ? budgets[0] : null)
        if (activeBudget) {
          const pair = await loadComparisonPair(activeCompany.id, activeBudget.id).catch(() => null)
          if (!mounted) return
          const pairMonths = monthsBetween(activeBudget.startDate, activeBudget.endDate)
          setFetchedMonths(pairMonths)
          setFetchedBudget(pair?.budget ?? null)
          setFetchedActual(pair?.actual ?? null)
          setFetchedClassified(pair?.classifiedActuals ?? [])
        } else {
          const year = currentFiscalYear()
          const bounds = calendarYearBounds(year)
          const yearMonths = monthsBetween(bounds.startDate, bounds.endDate)
          const slices = await Promise.all([
            listClassifiedActualSlices(
              activeCompany.id,
              bounds.startDate,
              bounds.endDate,
            ).catch(() => []),
            listClassifiedErpSlices(
              activeCompany.id,
              bounds.startDate,
              bounds.endDate,
            ).catch(() => []),
          ]).then(([a, b]) => [...a, ...b])
          if (!mounted) return
          setFetchedMonths(yearMonths)
          setFetchedBudget(null)
          setFetchedActual(null)
          setFetchedClassified(slices)
        }
      }

      if (customResult.ok) setError('')
      setLoading(false)
    })()

    return () => {
      mounted = false
    }
  }, [activeCompany, companyProfile, segments, providedRealized, reloadKey])

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

  const cards = useMemo<UnitCostCardModel[]>(() => {
    const month = months.find((item) => item.key === monthKey)
    const monthKeys = months.map((item) => item.key)
    const cardMonthKey = isConsolidated ? CONSOLIDATED_VOLUME_KEY : monthKey
    const cardMonthLabel = isConsolidated
      ? 'Período completo'
      : (month?.fullLabel ?? monthKey)
    const catalogCards = defs.map((def) => {
      const stored = volumes[def.indicatorCode] ?? {}
      const nextVolumes = isEmployeeHeadcountIndicator(def.indicatorCode)
        ? mergeEmployeeVolumes(stored, employeeCount, monthKeys)
        : stored
      return buildUnitCostCard({
        def: {
          indicatorCode: def.indicatorCode,
          indicatorName: def.indicatorName,
          displayUnit: def.displayUnit,
          quantityPrompt: def.quantityPrompt,
          quantityHelp: def.quantityHelp,
          quantityNoun: def.quantityNoun,
          quantityNounSingular: def.quantityNounSingular,
        },
        kind: 'catalog',
        segmentLabel:
          revenueIndicatorGroupLabel(def.indicatorCode) ??
          (isEmployeeHeadcountIndicator(def.indicatorCode)
            ? 'Empresa'
            : segmentLabel(def.segmentCode as SegmentCode)),
        formula: formulaForUnitCost(def.indicatorCode),
        volumes: nextVolumes,
        monthKey: cardMonthKey,
        monthLabel: cardMonthLabel,
        previousKey: isConsolidated ? null : (previous?.key ?? null),
        totals,
        isConsolidated,
      })
    })

    const customCards = customIndicators.map((item) => {
      const code = customIndicatorVolumeCode(item.id)
      const formula = parseIndicatorFormula(item.formula)
      return buildUnitCostCard({
        def: customIndicatorDefFromUnit({
          code: item.unit_code,
          name: item.unit_name,
          quantityNoun: item.quantity_noun,
          quantityNounSingular: item.quantity_noun_singular,
          indicatorName: item.name,
          displayUnit: item.display_unit,
          indicatorCode: code,
        }),
        kind: 'custom',
        customId: item.id,
        segmentLabel: 'Personalizado',
        formula,
        volumes: volumes[code] ?? {},
        monthKey: cardMonthKey,
        monthLabel: cardMonthLabel,
        previousKey: isConsolidated ? null : (previous?.key ?? null),
        totals,
        isConsolidated,
      })
    })

    return [...catalogCards, ...customCards]
  }, [
    defs,
    customIndicators,
    volumes,
    months,
    monthKey,
    isConsolidated,
    totals,
    previous,
    employeeCount,
  ])

  const saveQuantity = async (indicatorCode: string, quantity: number, month: string) => {
    if (!activeCompany) return { ok: false as const, message: 'Empresa não encontrada.' }
    setSavingCode(indicatorCode)

    const current = volumes[indicatorCode] ?? {}
    const saved = await saveUnitVolume({
      companyId: activeCompany.id,
      indicatorCode,
      monthKey: month,
      quantity,
      current,
    })
    setSavingCode('')
    if (!saved.ok) {
      setError(saved.message)
      return saved
    }
    setVolumes((prev) => ({ ...prev, [indicatorCode]: saved.data }))
    return saved
  }

  const deleteCustom = async (indicatorId: string) => {
    if (!activeCompany) return { ok: false as const, message: 'Empresa não encontrada.' }
    const result = await deleteCompanyCustomIndicator(activeCompany.id, indicatorId)
    if (!result.ok) {
      setError(result.message)
      return result
    }
    setCustomIndicators((current) => current.filter((item) => item.id !== indicatorId))
    return result
  }

  const monthLabel = isConsolidated
    ? 'Período completo'
    : (months.find((item) => item.key === monthKey)?.fullLabel ?? monthKey)

  const series = useMemo(
    () => buildFinancialSeries(months, actual, classified, fetchedBudget),
    [months, actual, classified, fetchedBudget]
  )

  const currentFinancials = useMemo(
    () =>
      isConsolidated
        ? periodFinancials(months, actual, classified, fetchedBudget)
        : (series.find((item) => item.key === monthKey) ?? series[series.length - 1] ?? null),
    [isConsolidated, months, actual, classified, fetchedBudget, series, monthKey]
  )
  const previousFinancials = useMemo(
    () =>
      isConsolidated
        ? null
        : previous
          ? (series.find((item) => item.key === previous.key) ?? null)
          : null,
    [isConsolidated, series, previous]
  )

  const totalCost = currentFinancials?.realized ?? 0
  const previousTotalCost = previousFinancials?.realized ?? null

  return {
    cards,
    customUnits,
    reloadCustom,
    deleteCustom,
    months,
    periodKey,
    isConsolidated,
    monthKey,
    monthLabel,
    previousMonthLabel: previous?.fullLabel ?? '',
    totalCost,
    previousTotalCost,
    costChange: changeRatio(totalCost, previousTotalCost),
    series,
    currentFinancials,
    previousFinancials,
    formulaContext: {
      period: isConsolidated
        ? totals.consolidated
        : monthKey
          ? (totals.byMonth[monthKey] ?? { revenue: 0, cost: 0, expense: 0 })
          : { revenue: 0, cost: 0, expense: 0 },
      consolidated: totals.consolidated,
      periodQuantity: null,
      consolidatedQuantity: null,
    },
    loading: Boolean(activeCompany) && loading,
    error,
    savingCode,
    saveQuantity,
  }
}

export type HomeDashboardData = ReturnType<typeof useUnitCostCards>
