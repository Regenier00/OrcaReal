export const COST_CENTERS_REQUIRED_FOR_BUDGET_MESSAGE =
  'Defina ao menos um centro de custo antes de criar um orçamento. Sem centros de custo, o orçamento fica sem destino.'

export function assertCanCreateBudget(hasCostCenters: boolean) {
  if (!hasCostCenters) {
    throw new Error(COST_CENTERS_REQUIRED_FOR_BUDGET_MESSAGE)
  }
}
