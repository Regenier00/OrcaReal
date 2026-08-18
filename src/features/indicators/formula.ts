import { roundMoney } from '../budget/money.ts'
import { sum } from '../../lib/money.ts'
import {
  sumClassifiedForMonth,
  sumItemsForMonth,
  type AmountItem,
  type ClassifiedSlice,
} from '../home/dashboardModel.ts'
import type { BudgetMonth } from '../budget/period.ts'

export type FormulaMetric = 'actual_revenue' | 'actual_cost' | 'quantity'
export type FormulaScope = 'period' | 'consolidated'
export type FormulaOp = 'div' | 'mul' | 'add' | 'sub'

export interface FormulaOperand {
  metric: FormulaMetric
  scope: FormulaScope
}

export interface CustomFormula {
  left: FormulaOperand
  op: FormulaOp
  right: FormulaOperand
}

export interface ActualSideTotals {
  revenue: number
  cost: number
}

export interface FormulaContext {
  period: ActualSideTotals
  consolidated: ActualSideTotals
  periodQuantity: number | null
  consolidatedQuantity: number | null
}

export const FORMULA_METRICS: Array<{
  id: FormulaMetric
  label: string
  money: boolean
}> = [
  { id: 'actual_revenue', label: 'Receitas realizadas', money: true },
  { id: 'actual_cost', label: 'Custos realizados', money: true },
  { id: 'quantity', label: 'Quantidade da unidade', money: false },
]

export const FORMULA_SCOPES: Array<{ id: FormulaScope; label: string }> = [
  { id: 'period', label: 'Período' },
  { id: 'consolidated', label: 'Consolidado' },
]

export const FORMULA_OPS: Array<{ id: FormulaOp; label: string; symbol: string }> = [
  { id: 'div', label: 'Dividir', symbol: '÷' },
  { id: 'mul', label: 'Multiplicar', symbol: '×' },
  { id: 'add', label: 'Somar', symbol: '+' },
  { id: 'sub', label: 'Subtrair', symbol: '−' },
]

export function defaultCustomFormula(): CustomFormula {
  return {
    left: { metric: 'actual_cost', scope: 'period' },
    op: 'div',
    right: { metric: 'quantity', scope: 'period' },
  }
}

export function isCustomFormula(value: unknown): value is CustomFormula {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<CustomFormula>
  return isOperand(row.left) && isOperand(row.right) && isOp(row.op)
}

function isOperand(value: unknown): value is FormulaOperand {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<FormulaOperand>
  return isMetric(row.metric) && isScope(row.scope)
}

function isMetric(value: unknown): value is FormulaMetric {
  return value === 'actual_revenue' || value === 'actual_cost' || value === 'quantity'
}

function isScope(value: unknown): value is FormulaScope {
  return value === 'period' || value === 'consolidated'
}

function isOp(value: unknown): value is FormulaOp {
  return value === 'div' || value === 'mul' || value === 'add' || value === 'sub'
}

export const CONSOLIDATED_VOLUME_KEY = 'all'

export function formulaUsesQuantity(formula: CustomFormula) {
  return formula.left.metric === 'quantity' || formula.right.metric === 'quantity'
}

export function quantityOperand(formula: CustomFormula): FormulaOperand | null {
  if (formula.right.metric === 'quantity') return formula.right
  if (formula.left.metric === 'quantity') return formula.left
  return null
}

export function secondOperandIsPeriod(formula: CustomFormula) {
  return formula.right.scope === 'period'
}

export function quantityVolumeKey(formula: CustomFormula, monthKey: string) {
  return quantityOperand(formula)?.scope === 'consolidated'
    ? CONSOLIDATED_VOLUME_KEY
    : monthKey
}

export function operandLabel(operand: FormulaOperand) {
  const metric = FORMULA_METRICS.find((item) => item.id === operand.metric)?.label ?? operand.metric
  const scope = FORMULA_SCOPES.find((item) => item.id === operand.scope)?.label ?? operand.scope
  return `${metric} (${scope.toLowerCase()})`
}

export function formulaHint(formula: CustomFormula) {
  const op = FORMULA_OPS.find((item) => item.id === formula.op)?.symbol ?? formula.op
  return `${operandLabel(formula.left)} ${op} ${operandLabel(formula.right)}`
}

export function suggestedDisplayUnit(formula: CustomFormula, unitName: string) {
  const leftMoney = formula.left.metric !== 'quantity'
  const rightMoney = formula.right.metric !== 'quantity'
  if (formula.op === 'div' && leftMoney && !rightMoney) {
    return `R$/${unitName.toLowerCase()}`
  }
  if (formula.op === 'div' && leftMoney && rightMoney) {
    return 'x'
  }
  if (leftMoney || rightMoney) return 'R$'
  return unitName
}

function applyOp(op: FormulaOp, left: number, right: number): number | null {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null
  if (op === 'div') {
    if (right === 0) return null
    return left / right
  }
  if (op === 'mul') return left * right
  if (op === 'add') return left + right
  return left - right
}

export function readOperandValue(
  operand: FormulaOperand,
  context: FormulaContext
): number | null {
  if (operand.metric === 'quantity') {
    return operand.scope === 'consolidated' ? context.consolidatedQuantity : context.periodQuantity
  }
  const totals = operand.scope === 'consolidated' ? context.consolidated : context.period
  return operand.metric === 'actual_revenue' ? totals.revenue : totals.cost
}

export function evaluateFormula(
  formula: CustomFormula,
  context: FormulaContext
): number | null {
  const left = readOperandValue(formula.left, context)
  const right = readOperandValue(formula.right, context)
  if (left == null || right == null) return null
  const raw = applyOp(formula.op, left, right)
  if (raw == null) return null
  return roundMoney(raw)
}

export function actualRevenueForMonth(
  actual: { items: AmountItem[] } | null,
  classified: ClassifiedSlice[],
  month: string
) {
  return roundMoney(
    sumItemsForMonth(actual?.items, month, ['revenue']) +
      sumClassifiedForMonth(classified, month, ['income'])
  )
}

export function actualCostForMonth(
  actual: { items: AmountItem[] } | null,
  classified: ClassifiedSlice[],
  month: string
) {
  return roundMoney(
    sumItemsForMonth(actual?.items, month, 'non-revenue') +
      sumClassifiedForMonth(classified, month, ['expense'])
  )
}

export function buildActualTotals(
  months: BudgetMonth[],
  actual: { items: AmountItem[] } | null,
  classified: ClassifiedSlice[]
): { byMonth: Record<string, ActualSideTotals>; consolidated: ActualSideTotals } {
  const byMonth: Record<string, ActualSideTotals> = {}
  for (const month of months) {
    byMonth[month.key] = {
      revenue: actualRevenueForMonth(actual, classified, month.key),
      cost: actualCostForMonth(actual, classified, month.key),
    }
  }
  const consolidated: ActualSideTotals = {
    revenue: roundMoney(sum(Object.values(byMonth).map((item) => item.revenue))),
    cost: roundMoney(sum(Object.values(byMonth).map((item) => item.cost))),
  }
  return { byMonth, consolidated }
}

export function consolidatedQuantity(volumes: Record<string, number>) {
  const fixed = volumes[CONSOLIDATED_VOLUME_KEY]
  if (Number.isFinite(fixed) && fixed > 0) return fixed
  const total = sum(
    Object.entries(volumes)
      .filter(([key, value]) => key !== CONSOLIDATED_VOLUME_KEY && Number.isFinite(value) && value > 0)
      .map(([, value]) => value)
  )
  return total > 0 ? total : null
}
