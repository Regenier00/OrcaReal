/**
 * Filtro usado pelos indicadores (agregação legada no cliente):
 * receitas e investimentos ficam de fora da concentração de custos.
 * A página Orçado × Realizado usa a RPC get_budget_vs_actual_by_money_group
 * e apresenta os quatro grupos no backend.
 */

export function classifiedAmountForComparison(
  type: string,
  amount: number,
  moneyGroup?: string | null
) {
  if (moneyGroup === 'revenue' || moneyGroup === 'investment') return 0
  if (type === 'expense') return amount
  return 0
}

export function isComparisonMoneyGroup(moneyGroup: string | null | undefined) {
  return moneyGroup !== 'revenue' && moneyGroup !== 'investment'
}

export function isComparisonCategory(categoryType: string | null | undefined) {
  return categoryType !== 'revenue'
}
