export const EMPLOYEE_COUNT_QUESTION = 'employee_count'
export const COST_PER_EMPLOYEE = 'cost_per_employee'
export const REVENUE_PER_EMPLOYEE = 'revenue_per_employee'

export function parseEmployeeCount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value)
  }
  if (typeof value === 'string') {
    const normalized = value.trim().replace(/\s/g, '').replace(',', '.')
    const parsed = Number(normalized)
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed)
  }
  return null
}

export function isEmployeeHeadcountIndicator(code: string) {
  return code === COST_PER_EMPLOYEE || code === REVENUE_PER_EMPLOYEE
}

export function volumesFromEmployeeCount(
  count: number | null | undefined,
  monthKeys: string[]
): Record<string, number> {
  return mergeEmployeeVolumes({}, count, monthKeys)
}

/** Usa o quadro do cadastro só como valor inicial para meses ainda sem quantidade informada. */
export function mergeEmployeeVolumes(
  stored: Record<string, number>,
  defaultCount: number | null | undefined,
  monthKeys: string[]
): Record<string, number> {
  const result = { ...stored }
  const qty = parseEmployeeCount(defaultCount)
  if (qty == null) return result
  for (const key of monthKeys) {
    if (result[key] == null) result[key] = qty
  }
  return result
}
