export const CHART_ACCOUNTS_REQUIRED_FOR_IMPORT_MESSAGE =
  'Defina a classificação das contas contábeis antes de importar extrato ou arquivo ERP. Cadastre ao menos um prefixo em Empresa → Classificação.'

export function assertCanImportWithChartAccounts(hasChartAccounts: boolean) {
  if (!hasChartAccounts) {
    throw new Error(CHART_ACCOUNTS_REQUIRED_FOR_IMPORT_MESSAGE)
  }
}
