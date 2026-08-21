import { supabase } from '@/lib/supabase'
import { assertSafeLedgerAccountFile } from '../../../supabase/functions/_shared/ledgerAccounts/inspect.ts'
import { parseLedgerAccountFile } from '../../../supabase/functions/_shared/ledgerAccounts/parse.ts'
import type { CompanyLedgerAccount, LedgerAccountImport } from '@/types/database'

export interface LedgerAccountImportSummary {
  inserted: number
  updated: number
  skipped: number
  total: number
}

export interface LedgerAccountImportResult {
  import: LedgerAccountImport | null
  summary: LedgerAccountImportSummary
  warnings: Array<{ message: string; row?: number }>
}

const ACCOUNT_SELECT = `
  id,
  company_id,
  account_code,
  account_name,
  is_active,
  created_by,
  created_at,
  updated_at
`

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
  error_message,
  warnings,
  created_by,
  created_at,
  updated_at,
  processed_at
`

function asWarnings(value: unknown): Array<{ message: string; row?: number }> {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is { message: string; row?: number } => {
    return Boolean(item && typeof item === 'object' && 'message' in item)
  })
}

function mapImport(row: LedgerAccountImport): LedgerAccountImport {
  return {
    ...row,
    warnings: asWarnings(row.warnings),
    detected_layout:
      row.detected_layout && typeof row.detected_layout === 'object'
        ? row.detected_layout
        : {},
  }
}

async function sha256Hex(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes)
  const digest = await crypto.subtle.digest('SHA-256', copy)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function listCompanyLedgerAccounts(
  companyId: string,
): Promise<CompanyLedgerAccount[]> {
  const { data, error } = await supabase
    .from('company_ledger_accounts')
    .select(ACCOUNT_SELECT)
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('account_code', { ascending: true })

  if (error) {
    console.error('Erro ao listar plano de contas:', error)
    throw new Error('Não foi possível carregar o plano de contas.')
  }

  return (data ?? []) as CompanyLedgerAccount[]
}

/**
 * Lê XLSX/CSV e envia linhas à RPC.
 * Dedupe, upsert e permissões ficam só no backend.
 */
export async function importLedgerAccountsFromFile(input: {
  companyId: string
  file: File
}): Promise<LedgerAccountImportResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado')

  const bytes = new Uint8Array(await input.file.arrayBuffer())
  const format = assertSafeLedgerAccountFile({
    fileName: input.file.name,
    mimeType: input.file.type || null,
    bytes,
  })

  const fileHash = await sha256Hex(bytes)
  const { data: created, error: createError } = await supabase
    .from('ledger_account_imports')
    .insert({
      company_id: input.companyId,
      file_name: input.file.name.slice(0, 240),
      file_size: bytes.byteLength,
      file_type: format,
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
        'Não foi possível iniciar a importação do plano de contas.',
    )
  }

  const row = mapImport(created as LedgerAccountImport)

  try {
    await supabase
      .from('ledger_account_imports')
      .update({
        status: 'parsing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('company_id', input.companyId)

    const parsed = await parseLedgerAccountFile({ bytes, format })

    await supabase
      .from('ledger_account_imports')
      .update({
        status: 'importing',
        detected_layout: parsed.layout,
        warnings: parsed.warnings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('company_id', input.companyId)

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'import_company_ledger_accounts',
      {
        p_company_id: input.companyId,
        p_import_id: row.id,
        p_rows: parsed.rows.map((item) => ({
          account_code: item.account_code,
          account_name: item.account_name,
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
      total?: number
    }

    const { data: finished } = await supabase
      .from('ledger_account_imports')
      .select(IMPORT_SELECT)
      .eq('id', row.id)
      .eq('company_id', input.companyId)
      .maybeSingle()

    return {
      import: finished ? mapImport(finished as LedgerAccountImport) : row,
      summary: {
        inserted: Number(summary.inserted ?? finished?.inserted_count ?? 0),
        updated: Number(summary.updated ?? finished?.updated_count ?? 0),
        skipped: Number(summary.skipped ?? finished?.skipped_count ?? 0),
        total: Number(summary.total ?? finished?.row_count ?? 0),
      },
      warnings: parsed.warnings,
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Falha ao processar o arquivo'

    await supabase
      .from('ledger_account_imports')
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
    normalized.includes('row-level security') ||
    normalized.includes('sem permissão')
  ) {
    return 'Sem permissão para importar o plano de contas nesta empresa.'
  }
  if (
    normalized.includes('does not exist') ||
    normalized.includes('schema cache') ||
    normalized.includes('could not find')
  ) {
    return 'A migration do plano de contas ainda não foi aplicada no Supabase.'
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

  if (message.toLowerCase().includes('sem permissão')) {
    return 'Sem permissão para importar o plano de contas nesta empresa.'
  }
  if (
    message.toLowerCase().includes('does not exist') ||
    message.toLowerCase().includes('schema cache')
  ) {
    return 'A migration do plano de contas ainda não foi aplicada no Supabase.'
  }
  return message || 'Falha ao gravar o plano de contas.'
}
