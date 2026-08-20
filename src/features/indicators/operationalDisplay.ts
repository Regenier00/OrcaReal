import { roundMoney, formatMoney } from '@/features/budget/money'
import { formatPct } from '@/lib/money'
import type { OperationalFormat } from '@/features/experience/catalog/operationModels'
import {
  evaluateOperationalFormula,
  type FormulaNode,
  type OperationalFormulaContext,
} from '@/features/indicators/operationalFormula'

export function formatOperationalValue(value: number, format: OperationalFormat) {
  if (format === 'money') return formatMoney(value)
  if (format === 'pct') return formatPct(value)
  if (format === 'months') {
    return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)} meses`
  }
  if (format === 'ratio') {
    return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)}x`
  }
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)
}

export function evaluateBreakdown(
  items: Array<{ label: string; formula: FormulaNode }>,
  ctx: OperationalFormulaContext
) {
  return items
    .map((item) => ({
      label: item.label,
      value: evaluateOperationalFormula(item.formula, ctx),
    }))
    .filter((item) => item.value != null) as Array<{ label: string; value: number }>
}

export function operationalContextFromTotals(input: {
  revenue: number
  cost: number
  expense?: number
  previousRevenue: number | null
  employeeCount: number | null
  inputs: Record<string, number>
}): OperationalFormulaContext {
  return {
    revenue: roundMoney(input.revenue),
    cost: roundMoney(input.cost),
    expense: roundMoney(input.expense ?? 0),
    previousRevenue: input.previousRevenue,
    employeeCount: input.employeeCount,
    inputs: input.inputs,
  }
}
