export const KPI_FORMULAS = {
  revenue: 'Receita',
  costs: 'Custo',
  expenses: 'Despesa',
  realized: 'Custo + Despesa',
  profit: 'Receita − Custo − Despesa',
  margin: '(Receita − Custo − Despesa) / Receita',
  variance: 'Realizado − Orçado',
  variancePct: '(Realizado − Orçado) / Orçado',
  totalCost: 'Custo + Despesa',
} as const

export type KpiFormulaId = keyof typeof KPI_FORMULAS
