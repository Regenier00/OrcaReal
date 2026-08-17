import { DEFAULT_COST_CENTER_NAMES, DEFAULT_DEPARTMENT_NAMES } from '@/features/company/defaultDepartments'

export interface StructureSuggestion {
  departments: string[]
  costCenters: string[]
}

const DEFAULT_STRUCTURE: StructureSuggestion = {
  departments: DEFAULT_DEPARTMENT_NAMES,
  costCenters: DEFAULT_COST_CENTER_NAMES,
}

export function structureSuggestionsFor(): StructureSuggestion {
  return DEFAULT_STRUCTURE
}

export function sequentialCostCenterCode(index: number): string {
  const next = index + 1
  return String(next).padStart(Math.max(3, String(next).length), '0')
}
