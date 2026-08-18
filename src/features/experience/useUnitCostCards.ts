import { useEffect, useMemo, useState } from 'react'
import { useCompany } from '@/features/company/useCompany'
import { isSegmentCode, segmentLabel, type SegmentCode } from '@/features/company/segmentOptions'
import { extraSegmentCodesFromAnswers } from '@/features/experience/conditions'
import { unitCostsForSegments, type SegmentUnitCostDef } from '@/features/experience/catalog/segmentUnits'
import { listCompanyOperations, getCompanyExperienceAnswers } from '@/features/experience/experienceService'
import { listUnitVolumes, saveUnitVolume } from '@/features/experience/unitVolumeService'
import {
  defaultUnitCostMonth,
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
import {
  buildActualTotals,
  consolidatedQuantity,
  defaultCustomFormula,
  evaluateFormula,
  formulaHint,
  formulaUsesQuantity,
  type ActualSideTotals,
  type CustomFormula,
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

export interface IndicatorCardDef {
  indicatorCode: string
  indicatorName: string
  displayUnit: string
  quantityPrompt: string
  quantityHelp: string
  quantityNoun: string
  quantityNounSingular: string
}

export interface UnitCostCardModel {
  def: IndicatorCardDef
  kind: 'catalog' | 'custom'
  customId?: string
  segmentLabel: string
  volumes: MonthlyVolumes
  monthKey: string
  monthLabel: string
  quantity: number | null
  unitCost: number | null
  previousUnitCost: number | null
  unitCostChange: number | null
  formula: CustomFormula
  formulaHint: string
  usesQuantity: boolean
  totalsByMonth: Record<string, ActualSideTotals>
  consolidated: ActualSideTotals
}

export function useUnitCostCards(input?: {
  months?: BudgetMonth[]
  preferredMonth?: string | null
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

      const nextDefs = unitCostsForSegments([...codes])
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

      if (customResult.ok) setError('')
      setLoading(false)
    })()

    return () => {
      mounted = false
    }
  }, [activeCompany, companyProfile, segments, providedRealized, reloadKey])

  const monthKey = useMemo(
    () => defaultUnitCostMonth(months, input?.preferredMonth) ?? months[months.length - 1]?.key ?? '',
    [months, input?.preferredMonth]
  )

  const totals = useMemo(
    () => buildActualTotals(months, actual, classified),
    [months, actual, classified]
  )

  const previous = useMemo(() => previousMonth(months, monthKey), [months, monthKey])

  const cards = useMemo<UnitCostCardModel[]>(() => {
    const month = months.find((item) => item.key === monthKey)
    const catalogCards = defs.map((def) =>
      buildCard({
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
        segmentLabel: segmentLabel(def.segmentCode as SegmentCode),
        formula: defaultCustomFormula(),
        volumes: volumes[def.indicatorCode] ?? {},
        monthKey,
        monthLabel: month?.fullLabel ?? monthKey,
        previousKey: previous?.key ?? null,
        totals,
      })
    )

    const customCards = customIndicators.map((item) => {
      const code = customIndicatorVolumeCode(item.id)
      const formula = parseIndicatorFormula(item.formula)
      return buildCard({
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
        monthKey,
        monthLabel: month?.fullLabel ?? monthKey,
        previousKey: previous?.key ?? null,
        totals,
      })
    })

    return [...catalogCards, ...customCards]
  }, [defs, customIndicators, volumes, months, monthKey, totals, previous])

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

  const monthLabel =
    months.find((item) => item.key === monthKey)?.fullLabel ?? monthKey
  const totalCost = monthKey ? (totals.byMonth[monthKey]?.cost ?? 0) : 0
  const previousTotalCost = previous ? (totals.byMonth[previous.key]?.cost ?? 0) : null

  const series = useMemo(
    () => buildFinancialSeries(months, actual, classified, fetchedBudget),
    [months, actual, classified, fetchedBudget]
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
    customUnits,
    reloadCustom,
    deleteCustom,
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
    formulaContext: {
      period: monthKey ? (totals.byMonth[monthKey] ?? { revenue: 0, cost: 0 }) : { revenue: 0, cost: 0 },
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

function buildCard(input: {
  def: IndicatorCardDef
  kind: 'catalog' | 'custom'
  customId?: string
  segmentLabel: string
  formula: CustomFormula
  volumes: MonthlyVolumes
  monthKey: string
  monthLabel: string
  previousKey: string | null
  totals: ReturnType<typeof buildActualTotals>
}): UnitCostCardModel {
  const periodQty = input.volumes[input.monthKey] ?? null
  const previousQty = input.previousKey ? (input.volumes[input.previousKey] ?? null) : null
  const qtyAll = consolidatedQuantity(input.volumes)
  const unitCost = evaluateFormula(input.formula, {
    period: input.totals.byMonth[input.monthKey] ?? { revenue: 0, cost: 0 },
    consolidated: input.totals.consolidated,
    periodQuantity: periodQty,
    consolidatedQuantity: qtyAll,
  })
  const previousUnitCost = input.previousKey
    ? evaluateFormula(input.formula, {
        period: input.totals.byMonth[input.previousKey] ?? { revenue: 0, cost: 0 },
        consolidated: input.totals.consolidated,
        periodQuantity: previousQty,
        consolidatedQuantity: qtyAll,
      })
    : null

  return {
    def: input.def,
    kind: input.kind,
    customId: input.customId,
    segmentLabel: input.segmentLabel,
    volumes: input.volumes,
    monthKey: input.monthKey,
    monthLabel: input.monthLabel,
    quantity: periodQty,
    unitCost,
    previousUnitCost,
    unitCostChange: changeRatio(unitCost ?? Number.NaN, previousUnitCost),
    formula: input.formula,
    formulaHint: formulaHint(input.formula),
    usesQuantity: formulaUsesQuantity(input.formula),
    totalsByMonth: input.totals.byMonth,
    consolidated: input.totals.consolidated,
  }
}

export type HomeDashboardData = ReturnType<typeof useUnitCostCards>
