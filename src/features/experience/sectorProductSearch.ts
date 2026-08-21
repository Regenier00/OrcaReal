import { supabase } from '@/lib/supabase'
import {
  productOptionLabel,
  productOptionValue,
  searchSectorProductsLocal,
  type SectorProductOption,
} from '@/features/experience/catalog/sectorProducts'
import type { QuestionOption } from '@/features/experience/types'

/** Alinhado ao sanitize do RPC `search_sector_products` (máx. 120). */
export const MAX_SECTOR_PRODUCT_QUERY_LENGTH = 120
const MAX_SEGMENTS = 8
const MAX_LIMIT = 40

function asRemoteProducts(value: unknown): SectorProductOption[] {
  if (!Array.isArray(value)) return []
  const result: SectorProductOption[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    if (typeof row.code !== 'string' || typeof row.name !== 'string') continue
    if (typeof row.segment_code !== 'string') continue
    result.push({
      code: row.code,
      name: row.name,
      description: typeof row.description === 'string' ? row.description : null,
      segmentCode: row.segment_code,
      sourceCode: typeof row.source_code === 'string' ? row.source_code : null,
      rankScore:
        row.rank_score == null || row.rank_score === ''
          ? undefined
          : Number(row.rank_score),
    })
  }
  return result
}

function sanitizeQuery(query?: string | null): string | null {
  if (query == null) return null
  const cleaned = query.replace(/[\u0000-\u001F\u007F]/g, '').trim()
  if (!cleaned) return null
  return cleaned.slice(0, MAX_SECTOR_PRODUCT_QUERY_LENGTH)
}

/** Busca produtos nas fontes do ramo (+ outras operações). Fallback local se RPC falhar. */
export async function searchSectorProducts(input: {
  segmentCodes: string[]
  query?: string | null
  limit?: number
  companyId?: string | null
}): Promise<SectorProductOption[]> {
  const segments = [
    ...new Set(input.segmentCodes.map((code) => code.trim().toLowerCase()).filter(Boolean)),
  ].slice(0, MAX_SEGMENTS)
  const query = sanitizeQuery(input.query)
  const limit = Math.max(1, Math.min(input.limit ?? 40, MAX_LIMIT))

  if (segments.length === 0 && !input.companyId) return []

  const { data, error } = await supabase.rpc('search_sector_products', {
    p_segment_codes: segments,
    p_query: query,
    p_limit: limit,
    p_company_id: input.companyId ?? null,
  })

  if (!error) {
    const remote = asRemoteProducts(data)
    if (remote.length > 0 || query == null) return remote
  }

  return searchSectorProductsLocal(segments, query, limit)
}

export function toQuestionOptions(
  products: SectorProductOption[],
  options?: { includeOther?: boolean }
): QuestionOption[] {
  const mapped = products.map((item) => ({
    value: productOptionValue(item),
    label: productOptionLabel(item),
  }))
  if (options?.includeOther !== false) {
    mapped.push({ value: 'outro', label: 'Outro' })
  }
  return mapped
}
