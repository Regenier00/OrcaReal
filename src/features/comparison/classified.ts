/** Entradas/receitas não entram no Orçado × Realizado; ficam nos cards e indicadores. */
export function classifiedAmountForComparison(type: string, amount: number) {
  if (type === 'expense') return amount
  return 0
}

export function isComparisonCategory(categoryType: string | null | undefined) {
  return categoryType !== 'revenue'
}
