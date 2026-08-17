import type { ExperienceCatalog } from '@/features/experience/types'

export function mergeCatalog(
  base: ExperienceCatalog,
  overlay?: Partial<ExperienceCatalog> | null
): ExperienceCatalog {
  if (!overlay) return base

  return {
    analysisUnits: mergeByCode(base.analysisUnits, overlay.analysisUnits),
    questions: mergeByCode(base.questions, overlay.questions),
    indicators: mergeByCode(base.indicators, overlay.indicators),
    structures: { ...base.structures, ...(overlay.structures ?? {}) },
  }
}

function mergeByCode<T extends { code: string }>(
  base: T[],
  overlay?: T[]
): T[] {
  if (!overlay?.length) return base
  const map = new Map(base.map((item) => [item.code, item]))
  for (const item of overlay) {
    map.set(item.code, { ...(map.get(item.code) as T | undefined), ...item })
  }
  return [...map.values()]
}
