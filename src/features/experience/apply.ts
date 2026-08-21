import { SEGMENT_OPTIONS, segmentLabel } from '@/features/company/segmentOptions'
import { extraSegmentCodesFromAnswers } from '@/features/experience/conditions'
import { structureFor } from '@/features/experience/catalog'
import {
  parseRevenueModelValues,
  revenueModelLabel,
  revenueUnitCostsFor,
  selectedRevenueModels,
} from '@/features/experience/catalog/revenueModels'
import { operationModelLabel } from '@/features/experience/catalog/operationModels'
import {
  formatSalesChannels,
  overlaySalesChannelStructure,
} from '@/features/experience/catalog/salesChannels'
import { resolveProductLabels } from '@/features/experience/catalog/sectorProducts'
import { defaultUnitCodesForSegments, unitCostsForSegments } from '@/features/experience/catalog/segmentUnits'
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

function asPositiveInt(value: AnswerValue): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value)
  }
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.').trim())
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed)
  }
  return null
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
    employee_count: null,
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
      const key = question.mapsTo.slice('profile.'.length)
      if (key === 'employee_count') {
        profile.employee_count = asPositiveInt(value)
        continue
      }
      if (key in profile && key !== 'profile_facts' && key !== 'profile_summary') {
        profile[key as 'company_size'] = asText(value)
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
  const structure = overlaySalesChannelStructure(
    mergeStructures(ctx.segmentCode, extraSegmentCodes, catalog),
    [ctx.segmentCode, ...extraSegmentCodes],
    ctx.answers
  )
  const analysisUnitCodes = unique([
    ...defaultUnitCodesForSegments([ctx.segmentCode, ...extraSegmentCodes]),
    ...structure.defaultUnitCodes,
  ])

  const nextCtx: EvaluationContext = {
    ...ctx,
    extraSegmentCodes,
    analysisUnitCodes,
  }

  const indicators = selectIndicators(catalog, nextCtx)
  const unitCostCodes = new Set(
    unitCostsForSegments([ctx.segmentCode, ...extraSegmentCodes]).map(
      (item) => item.indicatorCode
    )
  )
  for (const item of revenueUnitCostsFor(selectedRevenueModels(ctx.answers))) {
    unitCostCodes.add(item.indicatorCode)
  }
  for (const indicator of catalog.indicators) {
    if (!unitCostCodes.has(indicator.code)) continue
    if (indicators.some((item) => item.code === indicator.code)) continue
    indicators.push(indicator)
  }
  const profile = deriveProfile(catalog.questions, ctx.answers)
  normalizeProductFacts(profile.profile_facts)
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

  const facts = profile.profile_facts
  const channelSummary = formatSalesChannels(facts.sales_channel)

  const parts = [
    `Ramo: ${ramo}`,
    extras.length ? `Outras operações: ${extras.join(', ')}` : null,
    profile.primary_activity ? `Atividade: ${profile.primary_activity}` : null,
    profile.company_size ? `Porte: ${labelFor(profile.company_size)}` : null,
    profile.employee_count
      ? `Funcionários: ${profile.employee_count}`
      : profile.employee_count_range
        ? `Funcionários: ${labelFor(profile.employee_count_range)}`
        : null,
    revenueSummary(profile.revenue_model),
    profile.operation_model
      ? `Operação: ${operationModelLabel(profile.operation_model) || profile.operation_model}`
      : null,
    channelSummary ? `Canais: ${channelSummary}` : null,
    profile.state
      ? `Local: ${[profile.city, profile.state].filter(Boolean).join(' / ')}`
      : null,
    units ? `Unidades de análise: ${units}` : null,
  ].filter(Boolean)

  if (typeof facts.animal_count === 'number' || typeof facts.animal_count === 'string') {
    parts.push(`${facts.animal_count} animais`)
  }
  if (typeof facts.hectares === 'number' || typeof facts.hectares === 'string') {
    parts.push(`${facts.hectares} hectares`)
  }
  if (Array.isArray(facts.crops) && facts.crops.length > 0) {
    parts.push(`Culturas: ${facts.crops.join(', ')}`)
  }
  const products = productSummary(facts)
  if (products) parts.push(`Produtos/serviços: ${products}`)

  return parts.join(' · ')
}

function normalizeProductFacts(facts: Record<string, unknown>) {
  const raw: string[] = []
  for (const key of [
    'products_offered',
    'products_other_matches',
    'products_other_describe',
  ] as const) {
    const value = facts[key]
    if (Array.isArray(value)) raw.push(...value.map(String))
    else if (typeof value === 'string' && value.trim()) {
      raw.push(
        ...value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      )
    }
  }

  const labels = resolveProductLabels(
    raw.filter((item) => {
      const lower = item.toLowerCase()
      return lower !== 'outro' && lower !== 'outra' && lower !== 'outros' && lower !== '__skipped__'
    })
  )

  if (labels.length === 0) return

  facts.products_offered = labels
  // Lista canônica usada por destinos de orçamento e perfil econômico
  facts.products_sold = labels
}

function productSummary(facts: Record<string, unknown>): string | null {
  const keys = [
    'products_offered',
    'products_other_matches',
    'products_other_describe',
    'products_sold',
    'manufactured_products',
    'food_products',
    'tech_products',
    'media_products',
    'service_type',
    'beauty_services',
    'auto_services',
  ] as const
  const values: string[] = []
  for (const key of keys) {
    const raw = facts[key]
    if (Array.isArray(raw)) {
      values.push(...raw.map(String).map((item) => item.trim()).filter(Boolean))
    } else if (typeof raw === 'string' && raw.trim()) {
      values.push(
        ...raw
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      )
    }
  }
  const uniqueValues = unique(
    values.filter((item) => {
      const lower = item.toLowerCase()
      return lower !== 'outro' && lower !== 'outra' && lower !== 'outros'
    })
  )
  if (uniqueValues.length === 0) return null
  return resolveProductLabels(uniqueValues).join(', ')
}

function revenueSummary(value: string | null): string | null {
  const labels = parseRevenueModelValues(value).map(revenueModelLabel)
  if (labels.length === 0) return null
  return `Receita: ${labels.join(', ')}`
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
