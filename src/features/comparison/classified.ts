/**
 * Entradas/receitas e investimentos não entram no Orçado × Realizado;
 * ficam nos cards e indicadores.
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
