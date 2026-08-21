import {
  DEFAULT_COST_CENTER_NAMES,
  DEFAULT_DEPARTMENT_NAMES,
} from '@/features/company/defaultDepartments'
import { STRUCTURES } from '@/features/experience/catalog/structures'

export interface StructureSuggestion {
  departments: string[]
  costCenters: string[]
  generalCostCenters: string[]
  segmentCostCenters: string[]
}

function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of names) {
    const name = raw.trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(name)
  }
  return result
}

export function structureSuggestionsFor(
  segmentCodes: string[] = []
): StructureSuggestion {
  const codes = uniqueNames(segmentCodes)
  const segmentCostCenters = uniqueNames(
    codes.flatMap((code) => STRUCTURES[code]?.extraCostCenters ?? [])
  )
  const generalCostCenters = [...DEFAULT_COST_CENTER_NAMES]
  const costCenters = uniqueNames([
    ...generalCostCenters,
    ...segmentCostCenters,
  ])

  return {
    departments: DEFAULT_DEPARTMENT_NAMES,
    costCenters,
    generalCostCenters,
    segmentCostCenters,
  }
}

export function sequentialCostCenterCode(index: number): string {
  const next = index + 1
  return String(next).padStart(Math.max(3, String(next).length), '0')
}
