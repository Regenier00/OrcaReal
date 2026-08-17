import { SEGMENT_OPTIONS, segmentLabel } from '@/features/company/segmentOptions'
import { extraSegmentCodesFromAnswers } from '@/features/experience/conditions'
import { structureFor } from '@/features/experience/catalog'
import { buildDashboardLayout, selectIndicators } from '@/features/experience/indicators'
import type {
  AnswerValue,
  AppliedExperience,
  EvaluationContext,
  ExperienceAnswers,
  ExperienceCatalog,
  ExperienceQuestion,
  StructureTemplate,
} from '@/features/experience/types'

function asText(value: AnswerValue): string | null {
  if (value == null) return null
  if (Array.isArray(value)) return value.join(', ') || null
  const text = String(value).trim()
  return text || null
}

function asList(value: AnswerValue): string[] {
  if (value == null) return []
  if (Array.isArray(value)) return value.map(String)
  return [String(value)]
}

export function deriveProfile(
  questions: ExperienceQuestion[],
  answers: ExperienceAnswers
): AppliedExperience['profile'] {
  const facts: Record<string, unknown> = {}
  const profile: AppliedExperience['profile'] = {
    company_size: null,
    employee_count_range: null,
    state: null,
    city: null,
    operation_model: null,
    revenue_model: null,
    primary_activity: null,
    profile_facts: facts,
    profile_summary: '',
  }

  for (const question of questions) {
    if (!question.mapsTo) continue
    const value = answers[question.code]
    if (value == null || value === '__skipped__' || (Array.isArray(value) && value.length === 0)) continue

    if (question.mapsTo.startsWith('profile.')) {
      const key = question.mapsTo.slice('profile.'.length) as keyof Omit<
        AppliedExperience['profile'],
        'profile_facts' | 'profile_summary'
      >
      if (key in profile) {
        profile[key] = asText(value)
      }
      continue
    }

    if (question.mapsTo.startsWith('fact.')) {
      facts[question.mapsTo.slice('fact.'.length)] = value
    }
  }

  return profile
}

export function mergeStructures(
  primary: string,
  extraSegmentCodes: string[],
  catalog: ExperienceCatalog
): StructureTemplate {
  const templates = [primary, ...extraSegmentCodes].map(
    (code) => catalog.structures[code] ?? structureFor(code)
  )

  const extraDepartments = unique(templates.flatMap((item) => item.extraDepartments))
  const extraCostCenters = unique(templates.flatMap((item) => item.extraCostCenters))
  const extraCategories = uniqueBy(
    templates.flatMap((item) => item.extraCategories),
    (item) => `${item.type}:${item.name.toLowerCase()}`
  )
  const oxrDimensions = unique(templates.flatMap((item) => item.oxrDimensions))
  const defaultUnitCodes = unique(templates.flatMap((item) => item.defaultUnitCodes))

  return {
    extraDepartments,
    extraCostCenters,
    extraCategories,
    oxrDimensions,
    defaultUnitCodes,
  }
}

export function applyExperience(
  catalog: ExperienceCatalog,
  ctx: EvaluationContext
): AppliedExperience {
  const extraSegmentCodes = extraSegmentCodesFromAnswers(ctx.answers)
  const structure = mergeStructures(ctx.segmentCode, extraSegmentCodes, catalog)
  const analysisUnitCodes =
    ctx.analysisUnitCodes.length > 0
      ? ctx.analysisUnitCodes
      : structure.defaultUnitCodes

  const nextCtx: EvaluationContext = {
    ...ctx,
    extraSegmentCodes,
    analysisUnitCodes,
  }

  const indicators = selectIndicators(catalog, nextCtx)
  const profile = deriveProfile(catalog.questions, ctx.answers)
  profile.profile_summary = buildProfileSummary(
    ctx.segmentCode,
    extraSegmentCodes,
    profile,
    analysisUnitCodes,
    catalog
  )

  return {
    answers: ctx.answers,
    profile,
    analysisUnitCodes,
    extraOperations: extraSegmentCodes.map((code) => ({
      segmentCode: code,
      name: segmentLabel(code) || code,
    })),
    indicatorCodes: indicators.map((item) => item.code),
    dashboard: buildDashboardLayout(indicators),
    extraDepartments: structure.extraDepartments,
    extraCostCenters: structure.extraCostCenters,
    extraCategories: structure.extraCategories,
    oxrDimensions: structure.oxrDimensions,
  }
}

export function buildProfileSummary(
  segmentCode: string,
  extraSegmentCodes: string[],
  profile: AppliedExperience['profile'],
  unitCodes: string[],
  catalog: ExperienceCatalog
): string {
  const ramo = segmentLabel(segmentCode) || segmentCode
  const extras = extraSegmentCodes
    .map((code) => segmentLabel(code) || code)
    .filter(Boolean)
  const units = unitCodes
    .map((code) => catalog.analysisUnits.find((item) => item.code === code)?.name ?? code)
    .join(', ')

  const parts = [
    `Ramo: ${ramo}`,
    extras.length ? `Outras operações: ${extras.join(', ')}` : null,
    profile.primary_activity ? `Atividade: ${profile.primary_activity}` : null,
    profile.company_size ? `Porte: ${labelFor(profile.company_size)}` : null,
    profile.employee_count_range
      ? `Funcionários: ${labelFor(profile.employee_count_range)}`
      : null,
    profile.state
      ? `Local: ${[profile.city, profile.state].filter(Boolean).join(' / ')}`
      : null,
    units ? `Unidades de análise: ${units}` : null,
  ].filter(Boolean)

  const facts = profile.profile_facts
  if (typeof facts.animal_count === 'number' || typeof facts.animal_count === 'string') {
    parts.push(`${facts.animal_count} animais`)
  }
  if (typeof facts.hectares === 'number' || typeof facts.hectares === 'string') {
    parts.push(`${facts.hectares} hectares`)
  }
  if (Array.isArray(facts.crops) && facts.crops.length > 0) {
    parts.push(`Culturas: ${facts.crops.join(', ')}`)
  }

  return parts.join(' · ')
}

function unique(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const key = value.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(value)
  }
  return result
}

function uniqueBy<T>(values: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const value of values) {
    const key = keyOf(value)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(value)
  }
  return result
}

function labelFor(value: string): string {
  const match = SEGMENT_OPTIONS.find((item) => item.code === value)
  if (match) return match.label
  return value.replace(/_/g, ' ')
}

export function answerList(value: AnswerValue): string[] {
  return asList(value)
}
