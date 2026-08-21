import { supabase } from '@/lib/supabase'
import { mapCompanyError } from '@/features/company/companyErrors'
import { builtinCatalog } from '@/features/experience/catalog'
import { mergeCatalog } from '@/features/experience/mergeCatalog'
import type { AppliedExperience, DashboardLayout, ExperienceAnswers, ExperienceCatalog } from '@/features/experience/types'
import type { ServiceResult } from '@/features/company/companyService'
import {
  OPERATION_PRIORITIES_QUESTION,
  OPERATION_MODELS,
} from '@/features/experience/catalog/operationModels'

const OPERATIONAL_INDICATOR_CODES = OPERATION_MODELS.flatMap((model) =>
  model.indicators.map((item) => item.code)
)

function fail(error: unknown): ServiceResult<never> {
  return { ok: false, message: mapCompanyError(error) }
}

function asAnswers(rows: Array<{ question_code: string; answer: unknown }> | null): ExperienceAnswers {
  const answers: ExperienceAnswers = {}
  for (const row of rows ?? []) {
    const payload = row.answer as { value?: unknown } | unknown
    if (payload && typeof payload === 'object' && 'value' in payload) {
      answers[row.question_code] = (payload as { value: ExperienceAnswers[string] }).value
    } else {
      answers[row.question_code] = payload as ExperienceAnswers[string]
    }
  }
  return answers
}

export async function loadExperienceCatalog(): Promise<ExperienceCatalog> {
  const [unitsResult, questionsResult, indicatorsResult] = await Promise.all([
    supabase
      .from('analysis_units')
      .select('code, name, description, applicable_segments')
      .eq('is_active', true),
    supabase
      .from('onboarding_questions')
      .select(
        'code, question, help_text, answer_type, options, sort_order, segment_code, show_when, maps_to, is_continuous, option_source, is_optional'
      )
      .eq('is_active', true),
    supabase
      .from('system_indicators')
      .select(
        'code, name, description, formula_hint, formula, category, unit, applicable_segments, activation_conditions, unless_conditions, required_data, periodicity, dashboard_section, sort_order'
      )
      .eq('is_active', true),
  ])

  const overlay = {
    analysisUnits: (unitsResult.data ?? []).map((row) => ({
      code: row.code as string,
      name: row.name as string,
      description: (row.description as string | null) ?? undefined,
      segments: (row.applicable_segments as string[] | null) ?? [],
    })),
    questions: (questionsResult.data ?? []).map((row) => ({
      code: row.code as string,
      prompt: row.question as string,
      helpText: (row.help_text as string | null) ?? undefined,
      answerType: (row.answer_type as 'single' | 'multiple' | 'text' | 'number' | 'scale') ?? 'single',
      options: normalizeOptions(row.options),
      optionSource: (row.option_source as
        | 'static'
        | 'analysis_units'
        | 'segments'
        | 'operation_indicators'
        | 'sector_products'
        | 'sector_products_query'
        | null) ?? 'static',
      segmentCode: (row.segment_code as string | null) ?? null,
      showWhen: (row.show_when as ExperienceCatalog['questions'][number]['showWhen']) ?? undefined,
      mapsTo: (row.maps_to as string | null) ?? undefined,
      sortOrder: Number(row.sort_order ?? 0),
      optional: Boolean(row.is_optional),
      continuous: Boolean(row.is_continuous),
      ...(row.option_source === 'operation_indicators' ? { optionLayout: 'cards' as const } : {}),
    })),
    indicators: (indicatorsResult.data ?? []).map((row) => ({
      code: row.code as string,
      name: row.name as string,
      description: (row.description as string | null) ?? '',
      category: (row.category as 'financial' | 'operational' | 'strategic') ?? 'financial',
      unit: (row.unit as string | null) ?? 'R$',
      formula: (row.formula as string | null) ?? (row.formula_hint as string | null) ?? '',
      segments: (row.applicable_segments as string[] | null) ?? null,
      activation: row.activation_conditions as ExperienceCatalog['indicators'][number]['activation'],
      unless: row.unless_conditions as ExperienceCatalog['indicators'][number]['unless'],
      requiredData: (row.required_data as string[] | null) ?? [],
      periodicity: (row.periodicity as string | null) ?? 'monthly',
      dashboardSection:
        (row.dashboard_section as ExperienceCatalog['indicators'][number]['dashboardSection']) ??
        'financial',
      sortOrder: Number(row.sort_order ?? 0),
    })),
  }

  const hasDbCatalog =
    overlay.questions.length > 5 || overlay.indicators.length > 5 || overlay.analysisUnits.length > 0

  if (unitsResult.error && questionsResult.error && indicatorsResult.error) {
    return builtinCatalog
  }

  return hasDbCatalog ? mergeCatalog(builtinCatalog, overlay) : builtinCatalog
}

function normalizeOptions(value: unknown): ExperienceCatalog['questions'][number]['options'] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    if (typeof item === 'string') return { value: item, label: item }
    if (item && typeof item === 'object' && 'value' in item && 'label' in item) {
      return { value: String(item.value), label: String(item.label) }
    }
    return { value: String(item), label: String(item) }
  })
}

export async function getCompanyExperienceAnswers(
  companyId: string
): Promise<ServiceResult<ExperienceAnswers>> {
  const { data, error } = await supabase
    .from('company_profile_answers')
    .select('question_code, answer')
    .eq('company_id', companyId)
    .is('operation_id', null)

  if (error) return fail(error)
  return { ok: true, data: asAnswers(data) }
}

export async function saveExperienceProgress(input: {
  companyId: string
  answers: ExperienceAnswers
}): Promise<ServiceResult<true>> {
  const rows = Object.entries(input.answers).map(([questionCode, value]) => ({
    company_id: input.companyId,
    question_code: questionCode,
    answer: { value },
    operation_id: null,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase.from('company_profile_answers').upsert(rows, {
    onConflict: 'company_id,question_code',
  })

  if (error) return fail(error)
  return { ok: true, data: true }
}

export async function applyCompanyExperience(input: {
  companyId: string
  experience: AppliedExperience
  complete?: boolean
}): Promise<ServiceResult<true>> {
  const { error } = await supabase.rpc('apply_company_experience', {
    p_company_id: input.companyId,
    p_answers: Object.entries(input.experience.answers).map(([code, value]) => ({
      question_code: code,
      answer: { value },
    })),
    p_profile: input.experience.profile,
    p_analysis_units: input.experience.analysisUnitCodes,
    p_extra_operations: input.experience.extraOperations,
    p_indicator_defs: input.experience.indicatorCodes.map((code) => {
      const def = builtinCatalog.indicators.find((item) => item.code === code)
      return {
        code,
        name: def?.name ?? code,
        description: def?.description ?? '',
        category: def?.category ?? 'operational',
        unit: def?.unit ?? 'un',
        formula: def?.formula ?? '',
        dashboard_section: def?.dashboardSection ?? 'operational',
        sort_order: def?.sortOrder ?? 0,
      }
    }),
    p_dashboard: input.experience.dashboard,
    p_categories: input.experience.extraCategories,
    p_cost_centers: input.experience.extraCostCenters.map((name) => ({ name })),
    p_departments: input.experience.extraDepartments,
    p_complete: input.complete ?? true,
  })

  if (error) return fail(error)

  const employeeCount = input.experience.profile.employee_count
  if (employeeCount != null && Number.isFinite(employeeCount) && employeeCount > 0) {
    const { error: countError } = await supabase
      .from('company_profiles')
      .update({
        employee_count: Math.round(employeeCount),
        updated_at: new Date().toISOString(),
      })
      .eq('company_id', input.companyId)
    if (countError) return fail(countError)
  }

  return { ok: true, data: true }
}

export async function listCompanyOperations(companyId: string): Promise<
  ServiceResult<Array<Record<string, unknown>>>
> {
  const { data, error } = await supabase
    .from('company_operations')
    .select('id, company_id, segment_id, name, is_primary, profile_facts, created_at, updated_at')
    .eq('company_id', companyId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) return fail(error)
  return { ok: true, data: data ?? [] }
}

export async function listCompanyAnalysisUnits(companyId: string): Promise<
  ServiceResult<Array<Record<string, unknown>>>
> {
  const { data, error } = await supabase
    .from('company_analysis_units')
    .select(
      'id, company_id, operation_id, is_primary, analysis_unit:analysis_units(code, name, description)'
    )
    .eq('company_id', companyId)

  if (error) return fail(error)
  return { ok: true, data: data ?? [] }
}

export async function listEnabledCompanyIndicators(companyId: string): Promise<
  ServiceResult<Array<Record<string, unknown>>>
> {
  const { data, error } = await supabase
    .from('company_indicators')
    .select(
      'id, company_id, enabled, is_favorite, sort_order, target_value, dashboard_visible, operation_id, indicator:system_indicators(code, name, description, formula, formula_hint, category, unit, dashboard_section, sort_order)'
    )
    .eq('company_id', companyId)
    .eq('enabled', true)
    .order('sort_order', { ascending: true })

  if (error) return fail(error)
  return { ok: true, data: data ?? [] }
}

export async function updateCompanyDashboardLayout(input: {
  companyId: string
  layout: DashboardLayout | Record<string, unknown>
}): Promise<ServiceResult<true>> {
  const { data: existing, error: loadError } = await supabase
    .from('company_dashboards')
    .select('id')
    .eq('company_id', input.companyId)
    .eq('is_default', true)
    .maybeSingle()

  if (loadError) return fail(loadError)

  if (existing?.id) {
    const { error } = await supabase
      .from('company_dashboards')
      .update({ layout: input.layout, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) return fail(error)
  } else {
    const { error } = await supabase.from('company_dashboards').insert({
      company_id: input.companyId,
      name: 'Dashboard personalizado',
      layout: input.layout,
      is_default: true,
    })
    if (error) return fail(error)
  }

  return { ok: true, data: true }
}

export async function toggleCompanyIndicator(input: {
  companyId: string
  indicatorId: string
  enabled?: boolean
  isFavorite?: boolean
  dashboardVisible?: boolean
}): Promise<ServiceResult<true>> {
  const patch: Record<string, unknown> = {}
  if (input.enabled != null) patch.enabled = input.enabled
  if (input.isFavorite != null) patch.is_favorite = input.isFavorite
  if (input.dashboardVisible != null) patch.dashboard_visible = input.dashboardVisible

  const { error } = await supabase
    .from('company_indicators')
    .update(patch)
    .eq('company_id', input.companyId)
    .eq('id', input.indicatorId)

  if (error) return fail(error)
  return { ok: true, data: true }
}

export async function saveCompanyOperationalPriorities(input: {
  companyId: string
  codes: string[]
}): Promise<ServiceResult<true>> {
  const saved = await saveExperienceProgress({
    companyId: input.companyId,
    answers: { [OPERATION_PRIORITIES_QUESTION]: input.codes },
  })
  if (!saved.ok) return saved

  const { data: rows, error } = await supabase
    .from('system_indicators')
    .select('id, code')
    .in('code', OPERATIONAL_INDICATOR_CODES)

  if (error) return fail(error)

  const selected = new Set(input.codes)
  for (const row of rows ?? []) {
    const enabled = selected.has(String(row.code))
    const { error: upsertError } = await supabase.from('company_indicators').upsert(
      {
        company_id: input.companyId,
        indicator_id: row.id,
        enabled,
        dashboard_visible: enabled,
      },
      { onConflict: 'company_id,indicator_id' }
    )
    if (upsertError) return fail(upsertError)
  }

  return { ok: true, data: true }
}

export async function addCompanyOperation(input: {
  companyId: string
  segmentCode: string
  name: string
}): Promise<ServiceResult<{ id: string }>> {
  const { data, error } = await supabase.rpc('add_company_operation', {
    p_company_id: input.companyId,
    p_segment_code: input.segmentCode,
    p_name: input.name,
  })

  if (error) return fail(error)
  return { ok: true, data: { id: String(data) } }
}

export async function getCompanyDashboard(companyId: string): Promise<
  ServiceResult<{ id: string; name: string; layout: unknown; theme: unknown; is_default: boolean } | null>
> {
  const { data, error } = await supabase
    .from('company_dashboards')
    .select('id, name, layout, theme, is_default')
    .eq('company_id', companyId)
    .eq('is_default', true)
    .maybeSingle()

  if (error) return fail(error)
  return { ok: true, data }
}
