import type { SegmentUnitCostDef } from './segmentUnits'
import type { CustomFormula } from '../../indicators/formula'
import { defaultCustomFormula } from '../../indicators/formula'
import { COST_PER_EMPLOYEE, REVENUE_PER_EMPLOYEE } from '../employeeCount'

export const EMPLOYEE_HEADCOUNT_COSTS: SegmentUnitCostDef[] = [
  {
    segmentCode: 'other',
    indicatorCode: COST_PER_EMPLOYEE,
    indicatorName: 'Custo por funcionário',
    unitCode: 'employee',
    unitName: 'Funcionário',
    displayUnit: 'R$/funcionário',
    quantityPrompt: 'Quantos funcionários a empresa possui?',
    quantityHelp:
      'A quantidade vem do perfil da empresa e preenche este indicador automaticamente.',
    quantityNoun: 'funcionários',
    quantityNounSingular: 'funcionário',
  },
  {
    segmentCode: 'other',
    indicatorCode: REVENUE_PER_EMPLOYEE,
    indicatorName: 'Receita por funcionário',
    unitCode: 'employee',
    unitName: 'Funcionário',
    displayUnit: 'R$/funcionário',
    quantityPrompt: 'Quantos funcionários a empresa possui?',
    quantityHelp:
      'A quantidade vem do perfil da empresa e preenche este indicador automaticamente.',
    quantityNoun: 'funcionários',
    quantityNounSingular: 'funcionário',
  },
]

export function formulaForUnitCost(indicatorCode: string): CustomFormula {
  if (indicatorCode === REVENUE_PER_EMPLOYEE) {
    return {
      left: { metric: 'actual_revenue', scope: 'period' },
      op: 'div',
      right: { metric: 'quantity', scope: 'period' },
    }
  }
  return defaultCustomFormula()
}
