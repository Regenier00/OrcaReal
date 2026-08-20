import { supabase } from '@/lib/supabase'
import type { CostCenterImport } from '@/types/database'

export interface CostCenterImportSummary {
  inserted: number
  updated: number
  skipped: number
  destinationsEnsured: number
  total: number
}

export interface CostCenterImportResult {
  import: CostCenterImport | null
  summary: CostCenterImportSummary
  warnings: Array<{ message: string; row?: number }>
}

/**
 * Envia o XLSX à edge function. Tipo, tamanho e conteúdo são validados só no servidor.
 */
export async function importCostCentersFromXlsx(input: {
  companyId: string
  file: File
}): Promise<CostCenterImportResult> {
  const form = new FormData()
  form.append('companyId', input.companyId)
  form.append('file', input.file)

  const { data, error } = await supabase.functions.invoke(
    'process-cost-center-import',
    { body: form },
  )

  if (error) {
    const message = await readFunctionsError(error, data)
    throw new Error(message)
  }

  const payload = (data ?? {}) as {
    error?: string
    import?: CostCenterImport
    summary?: Partial<CostCenterImportSummary> & {
      destinations_ensured?: number
    }
    warnings?: Array<{ message: string; row?: number }>
  }

  if (payload.error) {
    throw new Error(payload.error)
  }

  return {
    import: payload.import ?? null,
    summary: {
      inserted: Number(payload.summary?.inserted ?? 0),
      updated: Number(payload.summary?.updated ?? 0),
      skipped: Number(payload.summary?.skipped ?? 0),
      destinationsEnsured: Number(
        payload.summary?.destinationsEnsured ??
          payload.summary?.destinations_ensured ??
          0,
      ),
      total: Number(payload.summary?.total ?? 0),
    },
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
  }
}

async function readFunctionsError(error: unknown, data: unknown) {
  if (data && typeof data === 'object' && 'error' in data) {
    const message = String((data as { error?: unknown }).error ?? '').trim()
    if (message) return message
  }

  const context = (error as { context?: Response } | null)?.context
  if (context && typeof context.json === 'function') {
    try {
      const body = (await context.json()) as { error?: string }
      if (body?.error) return body.error
    } catch {
      /* ignore */
    }
  }

  if (error instanceof Error && error.message) return error.message
  return 'Não foi possível importar os centros de custo.'
}
