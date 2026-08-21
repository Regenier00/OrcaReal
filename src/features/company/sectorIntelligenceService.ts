import { supabase } from '@/lib/supabase'
import { mapCompanyError } from '@/features/company/companyErrors'
import type { ServiceResult } from '@/features/company/companyService'
import type {
  SectorBenchmarkView,
  SectorDataSourceView,
  SectorIntelligence,
  SectorKnowledgeBucket,
} from '@/types/database'

function fail(error: unknown): ServiceResult<never> {
  return { ok: false, message: mapCompanyError(error) }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(String).filter((item) => item.trim().length > 0)
}

function asSources(value: unknown): SectorDataSourceView[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      if (typeof row.code !== 'string' || typeof row.name !== 'string') return null
      return {
        code: row.code,
        name: row.name,
        organization: typeof row.organization === 'string' ? row.organization : '',
        url: typeof row.url === 'string' ? row.url : null,
        segment_code: typeof row.segment_code === 'string' ? row.segment_code : '',
        priority: Number(row.priority ?? 100),
        selection_reason:
          typeof row.selection_reason === 'string' ? row.selection_reason : 'segment_match',
        reliability_tier: Number(row.reliability_tier ?? 1),
      } satisfies SectorDataSourceView
    })
    .filter((item): item is SectorDataSourceView => Boolean(item))
}

function asKnowledge(value: unknown): SectorKnowledgeBucket {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: SectorKnowledgeBucket = {}
  for (const [kind, items] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(items)) continue
    result[kind] = items
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        const row = item as Record<string, unknown>
        if (typeof row.code !== 'string' || typeof row.name !== 'string') return null
        return {
          code: row.code,
          name: row.name,
          description: typeof row.description === 'string' ? row.description : null,
          segment_code: typeof row.segment_code === 'string' ? row.segment_code : '',
          metadata:
            row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
              ? (row.metadata as Record<string, unknown>)
              : {},
          source_code: typeof row.source_code === 'string' ? row.source_code : null,
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
  }
  return result
}

function asBenchmarks(value: unknown): SectorBenchmarkView[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      if (typeof row.metric_code !== 'string' || typeof row.metric_name !== 'string') return null
      if (typeof row.source_code !== 'string' || typeof row.source_name !== 'string') return null
      return {
        metric_code: row.metric_code,
        metric_name: row.metric_name,
        segment_code: typeof row.segment_code === 'string' ? row.segment_code : '',
        subramo_code: typeof row.subramo_code === 'string' ? row.subramo_code : null,
        geography: typeof row.geography === 'string' ? row.geography : 'BR',
        period_label: typeof row.period_label === 'string' ? row.period_label : null,
        value_numeric:
          row.value_numeric == null || row.value_numeric === ''
            ? null
            : Number(row.value_numeric),
        value_text: typeof row.value_text === 'string' ? row.value_text : null,
        unit: typeof row.unit === 'string' ? row.unit : null,
        sample_notes: typeof row.sample_notes === 'string' ? row.sample_notes : null,
        source_code: row.source_code,
        source_name: row.source_name,
        external_ref: typeof row.external_ref === 'string' ? row.external_ref : null,
        fetched_at: typeof row.fetched_at === 'string' ? row.fetched_at : null,
      } satisfies SectorBenchmarkView
    })
    .filter((item): item is SectorBenchmarkView => Boolean(item))
}

function asIntelligence(value: unknown): SectorIntelligence | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (typeof row.company_id !== 'string' || typeof row.segment_code !== 'string') return null

  const extra = row.extra_segments
  const extraSegments = Array.isArray(extra)
    ? extra.map(String)
    : typeof extra === 'object' && extra
      ? Object.values(extra as Record<string, unknown>).map(String)
      : []

  return {
    company_id: row.company_id,
    segment_code: row.segment_code,
    extra_segments: extraSegments,
    subramo: typeof row.subramo === 'string' ? row.subramo : null,
    activity: typeof row.activity === 'string' ? row.activity : null,
    location_state: typeof row.location_state === 'string' ? row.location_state : null,
    location_city: typeof row.location_city === 'string' ? row.location_city : null,
    company_size: typeof row.company_size === 'string' ? row.company_size : null,
    products_services: asStringArray(row.products_services),
    revenue_model: typeof row.revenue_model === 'string' ? row.revenue_model : null,
    operation_model: typeof row.operation_model === 'string' ? row.operation_model : null,
    business_model_summary:
      typeof row.business_model_summary === 'string' ? row.business_model_summary : null,
    selected_sources: asSources(row.selected_sources),
    knowledge: asKnowledge(row.knowledge),
    benchmarks: asBenchmarks(row.benchmarks),
    benchmarks_available: Boolean(row.benchmarks_available),
    refreshed_at: typeof row.refreshed_at === 'string' ? row.refreshed_at : null,
  }
}

/** Lê o perfil setorial montado no banco (sem regras de seleção no frontend). */
export async function getCompanySectorIntelligence(
  companyId: string
): Promise<ServiceResult<SectorIntelligence>> {
  const { data, error } = await supabase.rpc('get_company_sector_intelligence', {
    p_company_id: companyId,
  })
  if (error) return fail(error)
  const intelligence = asIntelligence(data)
  if (!intelligence) {
    return { ok: false, message: 'Não foi possível carregar a inteligência setorial.' }
  }
  return { ok: true, data: intelligence }
}

/** Recalcula fontes e conhecimento a partir do perfil atual da empresa. */
export async function refreshCompanySectorIntelligence(
  companyId: string
): Promise<ServiceResult<SectorIntelligence>> {
  const { data, error } = await supabase.rpc('refresh_company_sector_intelligence', {
    p_company_id: companyId,
  })
  if (error) return fail(error)
  const intelligence = asIntelligence(data)
  if (!intelligence) {
    return { ok: false, message: 'Não foi possível atualizar a inteligência setorial.' }
  }
  return { ok: true, data: intelligence }
}

export const KNOWLEDGE_KIND_LABELS: Record<string, string> = {
  subramo: 'Subramos',
  activity: 'Atividades',
  product: 'Produtos e serviços',
  revenue: 'Receitas típicas',
  cost: 'Custos típicos',
  expense: 'Despesas típicas',
  indicator: 'Indicadores setoriais',
  benchmark_metric: 'Métricas de benchmark (quando houver dado ingerido)',
}
