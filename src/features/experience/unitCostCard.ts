import { changeRatio } from '../home/dashboardModel.ts'
import {
  CONSOLIDATED_VOLUME_KEY,
  consolidatedQuantity,
  evaluateFormula,
  formulaHint,
  formulaUsesQuantity,
  quantityOperand,
  secondOperandIsPeriod,
  type ActualSideTotals,
  type CustomFormula,
} from '../indicators/formula.ts'
import type { MonthlyVolumes } from './unitCost.ts'

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
  /** Página em Consolidados: período travado em todos os meses. */
  isConsolidated: boolean
  canChangePeriod: boolean
  quantityIsConsolidated: boolean
  totalsByMonth: Record<string, ActualSideTotals>
  consolidated: ActualSideTotals
}

export function buildUnitCostCard(input: {
  def: IndicatorCardDef
  kind: 'catalog' | 'custom'
  customId?: string
  segmentLabel: string
  formula: CustomFormula
  volumes: MonthlyVolumes
  monthKey: string
  monthLabel: string
  previousKey: string | null
  totals: {
    byMonth: Record<string, ActualSideTotals>
    consolidated: ActualSideTotals
  }
  isConsolidated?: boolean
}): UnitCostCardModel {
  const isConsolidated = Boolean(input.isConsolidated)
  const previousQty = input.previousKey ? (input.volumes[input.previousKey] ?? null) : null
  const qtyAll = consolidatedQuantity(input.volumes)
  const formulaQuantityIsConsolidated =
    quantityOperand(input.formula)?.scope === 'consolidated'
  const quantityIsConsolidated = isConsolidated || formulaQuantityIsConsolidated
  // Em Consolidados o período fica travado; em Mensais, só trava se a fórmula exigir.
  const canChangePeriod = !isConsolidated && secondOperandIsPeriod(input.formula)
  const periodTotals = isConsolidated
    ? input.totals.consolidated
    : (input.totals.byMonth[input.monthKey] ?? { revenue: 0, cost: 0, expense: 0 })
  const periodQty = isConsolidated
    ? qtyAll
    : (input.volumes[input.monthKey] ?? null)
  const unitCost = evaluateFormula(input.formula, {
    period: periodTotals,
    consolidated: input.totals.consolidated,
    periodQuantity: periodQty,
    consolidatedQuantity: qtyAll,
  })
  const previousUnitCost =
    canChangePeriod && input.previousKey
      ? evaluateFormula(input.formula, {
          period: input.totals.byMonth[input.previousKey] ?? { revenue: 0, cost: 0, expense: 0 },
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
    quantity: quantityIsConsolidated ? qtyAll : periodQty,
    unitCost,
    previousUnitCost,
    unitCostChange: changeRatio(unitCost ?? Number.NaN, previousUnitCost),
    formula: input.formula,
    formulaHint: formulaHint(input.formula),
    usesQuantity: formulaUsesQuantity(input.formula),
    isConsolidated,
    canChangePeriod,
    quantityIsConsolidated,
    totalsByMonth: input.totals.byMonth,
    consolidated: input.totals.consolidated,
  }
}

export { CONSOLIDATED_VOLUME_KEY }
