import { roundMoney } from '../budget/money.ts'

export type FormulaNode =
  | { type: 'revenue' }
  | { type: 'cost' }
  | { type: 'profit' }
  | { type: 'previousRevenue' }
  | { type: 'employeeCount' }
  | { type: 'number'; value: number }
  | { type: 'input'; key: string }
  | { type: 'op'; op: 'add' | 'sub' | 'mul' | 'div'; left: FormulaNode; right: FormulaNode }
  | { type: 'sum'; values: FormulaNode[] }
  | { type: 'max'; values: FormulaNode[] }
  | { type: 'min'; values: FormulaNode[] }
  | { type: 'breakEven'; fixed: FormulaNode; variable?: FormulaNode; sales?: FormulaNode }

export interface OperationalFormulaContext {
  revenue: number
  cost: number
  previousRevenue: number | null
  employeeCount: number | null
  inputs: Record<string, number | null | undefined>
}

export function revenue(): FormulaNode {
  return { type: 'revenue' }
}

export function cost(): FormulaNode {
  return { type: 'cost' }
}

export function profit(): FormulaNode {
  return { type: 'profit' }
}

export function previousRevenue(): FormulaNode {
  return { type: 'previousRevenue' }
}

export function employeeCount(): FormulaNode {
  return { type: 'employeeCount' }
}

export function lit(value: number): FormulaNode {
  return { type: 'number', value }
}

export function input(key: string): FormulaNode {
  return { type: 'input', key }
}

export function add(left: FormulaNode, right: FormulaNode): FormulaNode {
  return { type: 'op', op: 'add', left, right }
}

export function sub(left: FormulaNode, right: FormulaNode): FormulaNode {
  return { type: 'op', op: 'sub', left, right }
}

export function mul(left: FormulaNode, right: FormulaNode): FormulaNode {
  return { type: 'op', op: 'mul', left, right }
}

export function div(left: FormulaNode, right: FormulaNode): FormulaNode {
  return { type: 'op', op: 'div', left, right }
}

export function sum(values: FormulaNode[]): FormulaNode {
  return { type: 'sum', values }
}

export function max(values: FormulaNode[]): FormulaNode {
  return { type: 'max', values }
}

export function min(values: FormulaNode[]): FormulaNode {
  return { type: 'min', values }
}

export function ratio(numerator: FormulaNode, denominator: FormulaNode): FormulaNode {
  return div(numerator, denominator)
}

export function pct(numerator: FormulaNode, denominator: FormulaNode): FormulaNode {
  return div(numerator, denominator)
}

export function breakEven(
  fixed: FormulaNode,
  variable?: FormulaNode,
  sales?: FormulaNode
): FormulaNode {
  return { type: 'breakEven', fixed, variable, sales }
}

export function evaluateOperationalFormula(
  node: FormulaNode,
  ctx: OperationalFormulaContext
): number | null {
  const raw = evalNode(node, ctx)
  if (raw == null || !Number.isFinite(raw)) return null
  return roundMoney(raw)
}

function evalNode(node: FormulaNode, ctx: OperationalFormulaContext): number | null {
  switch (node.type) {
    case 'revenue':
      return finiteOrNull(ctx.revenue)
    case 'cost':
      return finiteOrNull(ctx.cost)
    case 'profit': {
      const left = finiteOrNull(ctx.revenue)
      const right = finiteOrNull(ctx.cost)
      if (left == null || right == null) return null
      return left - right
    }
    case 'previousRevenue':
      return finiteOrNull(ctx.previousRevenue)
    case 'employeeCount':
      return positiveOrNull(ctx.employeeCount)
    case 'number':
      return finiteOrNull(node.value)
    case 'input':
      return positiveOrZero(ctx.inputs[node.key])
    case 'op': {
      const left = evalNode(node.left, ctx)
      const right = evalNode(node.right, ctx)
      if (left == null || right == null) return null
      if (node.op === 'add') return left + right
      if (node.op === 'sub') return left - right
      if (node.op === 'mul') return left * right
      if (right === 0) return null
      return left / right
    }
    case 'sum': {
      const values = node.values
        .map((item) => evalNode(item, ctx))
        .filter((item): item is number => item != null)
      if (values.length === 0) return null
      return values.reduce((total, item) => total + item, 0)
    }
    case 'max': {
      const values = node.values
        .map((item) => evalNode(item, ctx))
        .filter((item): item is number => item != null)
      if (values.length === 0) return null
      return Math.max(...values)
    }
    case 'min': {
      const values = node.values
        .map((item) => evalNode(item, ctx))
        .filter((item): item is number => item != null)
      if (values.length === 0) return null
      return Math.min(...values)
    }
    case 'breakEven': {
      const fixed = evalNode(node.fixed, ctx)
      if (fixed == null || fixed < 0) return null
      const revenueValue =
        node.sales != null ? evalNode(node.sales, ctx) : finiteOrNull(ctx.revenue)
      if (revenueValue == null || revenueValue === 0) return null
      const variable =
        node.variable != null
          ? evalNode(node.variable, ctx)
          : Math.max((finiteOrNull(ctx.cost) ?? 0) - fixed, 0)
      if (variable == null) return null
      const contribution = revenueValue - variable
      if (contribution <= 0) return null
      return (fixed * revenueValue) / contribution
    }
  }
}

function finiteOrNull(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null
  return value
}

function positiveOrNull(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return value
}

function positiveOrZero(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null
  return value
}

export function formulaNeedsInput(node: FormulaNode, key: string): boolean {
  switch (node.type) {
    case 'input':
      return node.key === key
    case 'op':
      return formulaNeedsInput(node.left, key) || formulaNeedsInput(node.right, key)
    case 'sum':
    case 'max':
    case 'min':
      return node.values.some((item) => formulaNeedsInput(item, key))
    case 'breakEven':
      return (
        formulaNeedsInput(node.fixed, key) ||
        (node.variable != null && formulaNeedsInput(node.variable, key)) ||
        (node.sales != null && formulaNeedsInput(node.sales, key))
      )
    default:
      return false
  }
}

export function formulaInputKeys(node: FormulaNode): string[] {
  const keys = new Set<string>()
  collectInputKeys(node, keys)
  return [...keys]
}

function collectInputKeys(node: FormulaNode, keys: Set<string>) {
  switch (node.type) {
    case 'input':
      keys.add(node.key)
      return
    case 'op':
      collectInputKeys(node.left, keys)
      collectInputKeys(node.right, keys)
      return
    case 'sum':
    case 'max':
    case 'min':
      for (const item of node.values) collectInputKeys(item, keys)
      return
    case 'breakEven':
      collectInputKeys(node.fixed, keys)
      if (node.variable) collectInputKeys(node.variable, keys)
      if (node.sales) collectInputKeys(node.sales, keys)
      return
    default:
      return
  }
}
