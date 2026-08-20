import { supabase } from '@/lib/supabase'
import { assertSafeCostCenterXlsx } from '../../../supabase/functions/_shared/costCenters/inspect.ts'
import { parseCostCenterXlsx } from '../../../supabase/functions/_shared/costCenters/parse.ts'
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

const IMPORT_SELECT = `
  id,
  company_id,
  file_name,
  file_path,
  file_size,
  file_type,
  mime_type,
  file_hash,
  detected_layout,
  status,
  row_count,
  inserted_count,
  updated_count,
  skipped_count,
  destinations_ensured,
  error_message,
  warnings,
  created_by,
  created_at,
  updated_at,
  processed_at
`

function safeFileName(name: string) {
  return (
    name
      .replace(/[^\w.\-()+ ]+/g, '_')
      .replace(/^\.+/, '')
      .slice(0, 180) || 'centros-custo.xlsx'
  )
}

async function sha256Hex(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes)
  const digest = await crypto.subtle.digest('SHA-256', copy)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function asWarnings(value: unknown): Array<{ message: string; row?: number }> {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is { message: string; row?: number } => {
    return Boolean(item && typeof item === 'object' && 'message' in item)
  })
}

function mapImport(row: CostCenterImport): CostCenterImport {
  return {
    ...row,
    warnings: asWarnings(row.warnings),
    detected_layout:
      row.detected_layout && typeof row.detected_layout === 'object'
        ? row.detected_layout
        : {},
  }
}

/**
 * Importa centros de custo via XLSX.
 * Validação de tipo/tamanho/conteúdo usa o mesmo módulo da edge function;
 * persistência e regras de negócio ficam na RPC (admin + RLS).
 */
export async function importCostCentersFromXlsx(input: {
  companyId: string
  file: File
}): Promise<CostCenterImportResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado')

  const bytes = new Uint8Array(await input.file.arrayBuffer())
  assertSafeCostCenterXlsx({
    fileName: input.file.name,
    mimeType: input.file.type || null,
    bytes,
  })

  const fileHash = await sha256Hex(bytes)
  const { data: created, error: createError } = await supabase
    .from('cost_center_imports')
    .insert({
      company_id: input.companyId,
      file_name: input.file.name.slice(0, 240),
      file_size: bytes.byteLength,
      file_type: 'xlsx',
      mime_type: input.file.type || null,
      file_hash: fileHash,
      status: 'validating',
      created_by: user.id,
    })
    .select(IMPORT_SELECT)
    .single()

  if (createError || !created) {
    throw new Error(
      mapImportSetupError(createError) ||
        'Não foi possível iniciar a importação.',
    )
  }

  const row = mapImport(created as CostCenterImport)
  const path = `${input.companyId}/${row.id}/${safeFileName(input.file.name)}`

  try {
    const { error: uploadError } = await supabase.storage
      .from('cost-center-imports')
      .upload(path, bytes, {
        contentType:
          input.file.type ||
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: false,
      })

    if (uploadError) {
      throw new Error('Falha ao armazenar o arquivo.')
    }

    await supabase
      .from('cost_center_imports')
      .update({
        file_path: path,
        status: 'parsing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('company_id', input.companyId)

    const parsed = await parseCostCenterXlsx(bytes)

    await supabase
      .from('cost_center_imports')
      .update({
        status: 'importing',
        detected_layout: parsed.layout,
        warnings: parsed.warnings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('company_id', input.companyId)

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'import_company_cost_centers',
      {
        p_company_id: input.companyId,
        p_import_id: row.id,
        p_rows: parsed.rows.map((item) => ({
          name: item.name,
          code: item.code,
          description: item.description,
          row: item.row,
        })),
      },
    )

    if (rpcError) {
      throw new Error(mapRpcError(rpcError))
    }

    const summary = (rpcResult ?? {}) as {
      inserted?: number
      updated?: number
      skipped?: number
      destinations_ensured?: number
      total?: number
    }

    const { data: finished } = await supabase
      .from('cost_center_imports')
      .select(IMPORT_SELECT)
      .eq('id', row.id)
      .eq('company_id', input.companyId)
      .maybeSingle()

    return {
      import: finished ? mapImport(finished as CostCenterImport) : row,
      summary: {
        inserted: Number(summary.inserted ?? finished?.inserted_count ?? 0),
        updated: Number(summary.updated ?? finished?.updated_count ?? 0),
        skipped: Number(summary.skipped ?? finished?.skipped_count ?? 0),
        destinationsEnsured: Number(
          summary.destinations_ensured ?? finished?.destinations_ensured ?? 0,
        ),
        total: Number(summary.total ?? finished?.row_count ?? 0),
      },
      warnings: parsed.warnings,
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Falha ao processar o arquivo'

    await supabase
      .from('cost_center_imports')
      .update({
        status: 'failed',
        error_message: message.slice(0, 500),
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('company_id', input.companyId)

    throw new Error(message)
  }
}

function mapImportSetupError(error: unknown) {
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message ?? '')
      : ''
  const normalized = message.toLowerCase()

  if (
    normalized.includes('permission') ||
    normalized.includes('policy') ||
    normalized.includes('row-level security')
  ) {
    return 'Somente administradores podem importar centros de custo.'
  }
  if (
    normalized.includes('does not exist') ||
    normalized.includes('schema cache') ||
    normalized.includes('could not find')
  ) {
    return 'A migration de importação de centros de custo ainda não foi aplicada no Supabase.'
  }
  return message || null
}

function mapRpcError(error: unknown) {
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message ?? '')
      : error instanceof Error
        ? error.message
        : ''

  if (message.toLowerCase().includes('somente administradores')) {
    return 'Somente administradores podem importar centros de custo.'
  }
  if (
    message.toLowerCase().includes('does not exist') ||
    message.toLowerCase().includes('schema cache')
  ) {
    return 'A migration de importação de centros de custo ainda não foi aplicada no Supabase.'
  }
  return message || 'Falha ao gravar centros de custo.'
}
