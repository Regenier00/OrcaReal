import { roundMoney, formatMoney } from '../budget/money.ts'
import type { BudgetMonth } from '../budget/period.ts'
import { formatPct, sum } from '../../lib/money.ts'

export interface AmountItem {
  categoryType: string | null
  amounts: Record<string, number>
}

export interface ClassifiedSlice {
  monthKey: string
  amount: number
  type: string
}

export interface MonthFinancials {
  key: string
  label: string
  shortLabel: string
  revenue: number
  costs: number
  expenses: number
  realized: number
  budgeted: number
  profit: number
  margin: number | null
  variance: number
  variancePct: number | null
}

export type InsightTone = 'ok' | 'danger' | 'warn' | 'info'

export interface FinancialInsight {
  id: string
  tone: InsightTone
  title: string
  message: string
  href?: string
}

type CategoryFilter = Array<string | null> | 'non-revenue' | 'all'

export function sumItemsForMonth(
  items: AmountItem[] | undefined,
  month: string,
  types: CategoryFilter
) {
  return roundMoney(
    sum(
      (items ?? [])
        .filter((item) => matchesCategory(item.categoryType, types))
        .map((item) => item.amounts[month] ?? 0)
    )
  )
}

export function sumClassifiedForMonth(
  slices: ClassifiedSlice[],
  month: string,
  types: string[]
) {
  return roundMoney(
    sum(
      slices
        .filter((slice) => slice.monthKey === month && types.includes(slice.type))
        .map((slice) => slice.amount)
    )
  )
}

export function changeRatio(
  current: number,
  previous: number | null | undefined
): number | null {
  if (previous == null || !Number.isFinite(previous) || !Number.isFinite(current)) {
    return null
  }
  if (previous === 0) return current === 0 ? 0 : null
  return (current - previous) / previous
}

export function previousMonth(
  months: BudgetMonth[],
  monthKey: string
): BudgetMonth | null {
  const index = months.findIndex((item) => item.key === monthKey)
  if (index <= 0) return null
  return months[index - 1] ?? null
}

export function monthFinancials(
  month: BudgetMonth,
  actual: { items: AmountItem[] } | null,
  classified: ClassifiedSlice[],
  budget: { items: AmountItem[] } | null
): MonthFinancials {
  const revenue = roundMoney(
    sumItemsForMonth(actual?.items, month.key, ['revenue']) +
      sumClassifiedForMonth(classified, month.key, ['income'])
  )
  const costs = sumItemsForMonth(actual?.items, month.key, ['cost'])
  const expenses = roundMoney(
    sumItemsForMonth(actual?.items, month.key, ['expense']) +
      sumClassifiedForMonth(classified, month.key, ['expense'])
  )
  const realized = roundMoney(
    sumItemsForMonth(actual?.items, month.key, 'non-revenue') +
      sumClassifiedForMonth(classified, month.key, ['expense'])
  )
  const budgeted = sumItemsForMonth(budget?.items, month.key, 'non-revenue')
  const profit = roundMoney(revenue - realized)
  const margin = revenue > 0 ? profit / revenue : null
  const variance = roundMoney(realized - budgeted)
  const variancePct =
    budgeted === 0 ? (realized === 0 ? 0 : null) : variance / budgeted

  return {
    key: month.key,
    label: month.fullLabel,
    shortLabel: month.label,
    revenue,
    costs,
    expenses,
    realized,
    budgeted,
    profit,
    margin,
    variance,
    variancePct,
  }
}

export function buildFinancialSeries(
  months: BudgetMonth[],
  actual: { items: AmountItem[] } | null,
  classified: ClassifiedSlice[],
  budget: { items: AmountItem[] } | null,
  upToKey?: string
): MonthFinancials[] {
  const visible =
    upToKey && months.some((item) => item.key === upToKey)
      ? months.filter((item) => item.key <= upToKey)
      : months
  const source = visible.length >= 2 ? visible : months
  return source.map((month) => monthFinancials(month, actual, classified, budget))
}

export function hasAnyAmount(series: MonthFinancials[]) {
  return series.some(
    (item) =>
      item.revenue !== 0 ||
      item.realized !== 0 ||
      item.budgeted !== 0 ||
      item.profit !== 0
  )
}

export function buildFinancialInsights(input: {
  current: MonthFinancials | null
  previous: MonthFinancials | null
  hasBudget: boolean
  hasRealized: boolean
  unitCostMissing: boolean
}): FinancialInsight[] {
  const items: FinancialInsight[] = []
  const { current, previous, hasBudget, hasRealized, unitCostMissing } = input

  if (!hasRealized) {
    items.push({
      id: 'no-actual',
      tone: 'info',
      title: 'Comece pelo realizado',
      message:
        'Importe o extrato e aproprie os lançamentos para acompanhar a evolução financeira da empresa.',
      href: '/app/realizado',
    })
  }

  if (current && hasRealized && previous) {
    const costChange = changeRatio(current.realized, previous.realized)
    if (costChange != null && costChange > 0.03) {
      items.push({
        id: 'costs-up',
        tone: 'warn',
        title: 'Custos em alta',
        message: `Os custos e despesas de ${current.label} subiram ${formatPct(costChange)} em relação a ${previous.label}.`,
        href: '/app/orcado-realizado',
      })
    } else if (costChange != null && costChange < -0.03) {
      items.push({
        id: 'costs-down',
        tone: 'ok',
        title: 'Custos sob controle',
        message: `Os custos e despesas recuaram ${formatPct(Math.abs(costChange))} frente a ${previous.label}.`,
        href: '/app/orcado-realizado',
      })
    }
  }

  if (current && current.revenue > 0) {
    if (current.profit >= 0) {
      items.push({
        id: 'profit',
        tone: 'ok',
        title: 'Resultado positivo',
        message: `A operação gerou ${formatMoney(current.profit)} em ${current.label}${
          current.margin != null ? `, com margem de ${formatPct(current.margin)}` : ''
        }.`,
      })
    } else {
      items.push({
        id: 'loss',
        tone: 'danger',
        title: 'Resultado negativo',
        message: `O período fechou com ${formatMoney(current.profit)} após custos e despesas de ${formatMoney(current.realized)}.`,
        href: '/app/orcado-realizado',
      })
    }
  } else if (current && hasRealized && current.revenue === 0) {
    items.push({
      id: 'no-revenue',
      tone: 'info',
      title: 'Receita ainda não lançada',
      message: `Há ${formatMoney(current.realized)} em custos e despesas em ${current.label}, mas nenhuma receita apropriada no período.`,
      href: '/app/realizado',
    })
  }

  if (current && hasBudget && current.budgeted > 0 && current.variancePct != null) {
    if (current.variancePct > 0.05) {
      items.push({
        id: 'over-budget',
        tone: 'danger',
        title: 'Acima do orçado',
        message: `O realizado superou o orçamento em ${formatPct(current.variancePct)} neste mês.`,
        href: '/app/orcado-realizado',
      })
    } else if (current.variancePct < -0.05) {
      items.push({
        id: 'under-budget',
        tone: 'ok',
        title: 'Abaixo do orçado',
        message: `O realizado ficou ${formatPct(Math.abs(current.variancePct))} abaixo do planejado.`,
        href: '/app/orcado-realizado',
      })
    } else {
      items.push({
        id: 'on-budget',
        tone: 'info',
        title: 'Perto do plano',
        message: `O realizado está alinhado ao orçamento em ${current.label}.`,
        href: '/app/orcado-realizado',
      })
    }
  } else if (!hasBudget) {
    items.push({
      id: 'no-budget',
      tone: 'info',
      title: 'Monte o orçamento',
      message:
        'Com um orçamento ativo, o dashboard compara o plano com o realizado automaticamente.',
      href: '/app/orcamentos',
    })
  }

  if (unitCostMissing) {
    items.push({
      id: 'unit-cost',
      tone: 'info',
      title: 'Custo unitário incompleto',
      message:
        'Informe a quantidade do mês nos cards de unidade para calcular o custo por operação.',
    })
  }

  return uniqueInsights(items).slice(0, 4)
}

function matchesCategory(categoryType: string | null, types: CategoryFilter) {
  if (types === 'all') return true
  if (types === 'non-revenue') return categoryType !== 'revenue'
  return types.includes(categoryType)
}

function uniqueInsights(items: FinancialInsight[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}
