export const BUDGET_REQUIRED_FOR_IMPORT_MESSAGE =
  'Crie um orçamento antes de importar extrato ou arquivo ERP. Sem orçamento, o realizado não tem destino alinhado e pode ficar perdido.'

export function assertCanImportWithBudget(hasBudget: boolean) {
  if (!hasBudget) {
    throw new Error(BUDGET_REQUIRED_FOR_IMPORT_MESSAGE)
  }
}
