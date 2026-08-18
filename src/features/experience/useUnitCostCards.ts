import { useEffect, useMemo, useState } from 'react'
import { useCompany } from '@/features/company/useCompany'
import { isSegmentCode, segmentLabel, type SegmentCode } from '@/features/company/segmentOptions'
import { extraSegmentCodesFromAnswers } from '@/features/experience/conditions'
import { unitCostsForSegments, type SegmentUnitCostDef } from '@/features/experience/catalog/segmentUnits'
import { listCompanyOperations, getCompanyExperienceAnswers } from '@/features/experience/experienceService'
import { listUnitVolumes, saveUnitVolume } from '@/features/experience/unitVolumeService'
import {
  defaultUnitCostMonth,
  realizedCostForMonth,
  unitCostForMonth,
  type MonthlyVolumes,
} from '@/features/experience/unitCost'
import { listCompanyComparisonOptions, loadComparisonPair } from '@/features/comparison/comparisonService'
import type { ClassifiedActualSlice, LoadedActual } from '@/features/actual/model'
import type { LoadedBudget } from '@/features/budget/model'
import type { BudgetMonth } from '@/features/budget/period'
import { calendarYearBounds, currentFiscalYear, monthsBetween } from '@/features/budget/period'
import { listClassifiedActualSlices } from '@/features/actual/actualService'
import {
  buildFinancialSeries,
  changeRatio,
  previousMonth,
} from '@/features/home/dashboardModel'

export interface UnitCostCardModel {
  def: SegmentUnitCostDef
  segmentLabel: string
  volumes: MonthlyVolumes
  monthKey: string
  monthLabel: string
  totalCost: number
  quantity: number | null
  unitCost: number | null
  previousUnitCost: number | null
  unitCostChange: number | null
  costByMonth: Record<string, number>
}

export function useUnitCostCards(input?: {
  months?: BudgetMonth[]
  preferredMonth?: string | null
  actual?: LoadedActual | null
  classified?: ClassifiedActualSlice[]
}) {
  const { activeCompany, companyProfile, segments } = useCompany()
  const [defs, setDefs] = useState<SegmentUnitCostDef[]>([])
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

  const providedRealized = input?.actual !== undefined || input?.classified !== undefined
  const months = input?.months ?? fetchedMonths
  const actual = input?.actual !== undefined ? input.actual : fetchedActual
  const classified =
    input?.classified !== undefined ? input.classified : fetchedClassified

  useEffect(() => {
    if (!activeCompany) return
    let mounted = true

    void (async () => {
      setLoading(true)
      const [ops, answers, budgets] = await Promise.all([
        listCompanyOperations(activeCompany.id),
        getCompanyExperienceAnswers(activeCompany.id),
        providedRealized ? Promise.resolve([]) : listCompanyComparisonOptions(activeCompany.id).catch(() => []),
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

      const nextDefs = unitCostsForSegments([...codes])
      setDefs(nextDefs)

      const volumeResult = await listUnitVolumes(
        activeCompany.id,
        nextDefs.map((item) => item.indicatorCode)
      )
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
          const slices = await listClassifiedActualSlices(
            activeCompany.id,
            bounds.startDate,
            bounds.endDate
          ).catch(() => [])
          if (!mounted) return
          setFetchedMonths(yearMonths)
          setFetchedBudget(null)
          setFetchedActual(null)
          setFetchedClassified(slices)
        }
      }

      setError('')
      setLoading(false)
    })()

    return () => {
      mounted = false
    }
  }, [activeCompany, companyProfile, segments, providedRealized])

  const monthKey = useMemo(
    () => defaultUnitCostMonth(months, input?.preferredMonth) ?? months[months.length - 1]?.key ?? '',
    [months, input?.preferredMonth]
  )

  const costByMonth = useMemo(() => {
    const map: Record<string, number> = {}
    for (const month of months) {
      map[month.key] = realizedCostForMonth(actual, classified, month.key)
    }
    return map
  }, [months, actual, classified])

  const previous = useMemo(() => previousMonth(months, monthKey), [months, monthKey])

  const cards = useMemo<UnitCostCardModel[]>(() => {
    const month = months.find((item) => item.key === monthKey)
    const totalCost = monthKey ? (costByMonth[monthKey] ?? 0) : 0
    const previousCost = previous ? (costByMonth[previous.key] ?? 0) : 0

    return defs.map((def) => {
      const qty = volumes[def.indicatorCode]?.[monthKey] ?? null
      const previousQty = previous
        ? (volumes[def.indicatorCode]?.[previous.key] ?? null)
        : null
      const unitCost = unitCostForMonth(totalCost, qty)
      const previousUnitCost = unitCostForMonth(previousCost, previousQty)
      return {
        def,
        segmentLabel: segmentLabel(def.segmentCode as SegmentCode),
        volumes: volumes[def.indicatorCode] ?? {},
        monthKey,
        monthLabel: month?.fullLabel ?? monthKey,
        totalCost,
        quantity: qty,
        unitCost,
        previousUnitCost,
        unitCostChange: changeRatio(unitCost ?? Number.NaN, previousUnitCost),
        costByMonth,
      }
    })
  }, [defs, volumes, months, monthKey, costByMonth, previous])

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

  const monthLabel =
    months.find((item) => item.key === monthKey)?.fullLabel ?? monthKey
  const totalCost = monthKey ? (costByMonth[monthKey] ?? 0) : 0
  const previousTotalCost = previous ? (costByMonth[previous.key] ?? 0) : null

  const series = useMemo(
    () =>
      buildFinancialSeries(
        months,
        actual,
        classified,
        fetchedBudget,
        monthKey
      ),
    [months, actual, classified, fetchedBudget, monthKey]
  )

  const currentFinancials = useMemo(
    () => series.find((item) => item.key === monthKey) ?? series[series.length - 1] ?? null,
    [series, monthKey]
  )
  const previousFinancials = useMemo(
    () => (previous ? series.find((item) => item.key === previous.key) ?? null : null),
    [series, previous]
  )

  return {
    cards,
    months,
    monthKey,
    monthLabel,
    previousMonthLabel: previous?.fullLabel ?? '',
    totalCost,
    previousTotalCost,
    costChange: changeRatio(totalCost, previousTotalCost),
    series,
    currentFinancials,
    previousFinancials,
    loading: Boolean(activeCompany) && loading,
    error,
    savingCode,
    saveQuantity,
  }
}

export type HomeDashboardData = ReturnType<typeof useUnitCostCards>
