export const KPI_FORMULAS = {
  revenue: 'entradas apropriadas do mês',
  realized: 'custos + despesas do mês',
  profit: 'receita − saídas',
  margin: '(receita − saídas) / receita',
  variance: 'realizado − orçado',
  variancePct: '(realizado − orçado) / orçado',
  totalCost: 'custos + despesas do mês',
} as const

export type KpiFormulaId = keyof typeof KPI_FORMULAS
