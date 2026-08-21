import { listCompanyChartAccounts } from '@/features/erp/chartAccountService'

export {
  assertCanImportWithChartAccounts,
  CHART_ACCOUNTS_REQUIRED_FOR_IMPORT_MESSAGE,
} from '@/features/erp/chartAccountRules'

export async function companyHasChartAccounts(
  companyId: string,
): Promise<boolean> {
  const result = await listCompanyChartAccounts(companyId)
  if (!result.ok) {
    throw new Error(result.message)
  }
  return result.data.length > 0
}
