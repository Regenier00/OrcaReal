import { supabase } from '@/lib/supabase'
import {
  productOptionLabel,
  productOptionValue,
  searchSectorProductsLocal,
  type SectorProductOption,
} from '@/features/experience/catalog/sectorProducts'
import type { QuestionOption } from '@/features/experience/types'

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

/** Busca produtos nas fontes do ramo (+ outras operações). Fallback local se RPC falhar. */
export async function searchSectorProducts(input: {
  segmentCodes: string[]
  query?: string | null
  limit?: number
}): Promise<SectorProductOption[]> {
  const segments = input.segmentCodes.map((code) => code.trim()).filter(Boolean)
  if (segments.length === 0) return []

  const { data, error } = await supabase.rpc('search_sector_products', {
    p_segment_codes: segments,
    p_query: input.query?.trim() || null,
    p_limit: input.limit ?? 40,
  })

  if (!error) {
    const remote = asRemoteProducts(data)
    if (remote.length > 0) return remote
  }

  return searchSectorProductsLocal(segments, input.query, input.limit ?? 40)
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
