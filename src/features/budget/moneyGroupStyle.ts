import { cn } from '@/lib/utils'
import type { MoneyGroup } from './model'

/** Card surfaces for Receitas / Custos / Despesas / Investimentos. */
export function moneyGroupCardClass(
  moneyGroup: MoneyGroup,
  options?: { active?: boolean; className?: string }
) {
  const active = options?.active ?? true
  return cn(
    'rounded-2xl border p-4 transition',
    moneyGroup === 'revenue' &&
      (active
        ? 'border-revenue bg-revenue/80'
        : 'border-revenue/50 bg-revenue/40'),
    moneyGroup === 'cost' &&
      (active ? 'border-cost bg-cost/80' : 'border-cost/50 bg-cost/40'),
    moneyGroup === 'expense' &&
      (active
        ? 'border-expense bg-expense/80'
        : 'border-expense/50 bg-expense/40'),
    moneyGroup === 'investment' &&
      (active
        ? 'border-investment bg-investment-soft'
        : 'border-investment/40 bg-investment-soft/70'),
    options?.className
  )
}

export function moneyGroupTitleClass(moneyGroup: MoneyGroup) {
  return cn(
    'font-display text-lg font-semibold',
    moneyGroup === 'investment' ? 'text-investment' : 'text-ink'
  )
}

export function moneyGroupMutedClass(moneyGroup: MoneyGroup) {
  return cn(
    'text-sm',
    moneyGroup === 'investment' ? 'text-investment/80' : 'text-mist'
  )
}

export function moneyGroupAccentBarClass(moneyGroup: MoneyGroup) {
  return cn(
    'border-l-4',
    moneyGroup === 'revenue' && 'border-l-revenue',
    moneyGroup === 'cost' && 'border-l-cost',
    moneyGroup === 'expense' && 'border-l-expense',
    moneyGroup === 'investment' && 'border-l-investment'
  )
}
