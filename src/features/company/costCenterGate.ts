import { listCostCenters } from '@/features/company/companyService'

export {
  assertCanCreateBudget,
  COST_CENTERS_REQUIRED_FOR_BUDGET_MESSAGE,
} from '@/features/company/costCenterRules'

export async function companyHasCostCenters(companyId: string): Promise<boolean> {
  const result = await listCostCenters(companyId)
  if (!result.ok) {
    throw new Error(result.message)
  }
  return result.data.length > 0
}
