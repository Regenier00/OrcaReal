import { supabase } from '@/lib/supabase'
import { MAX_TRANSACTIONS } from '../../../supabase/functions/_shared/statement/limits.ts'
import { statementError, statementLog } from '../../../supabase/functions/_shared/statement/log.ts'
import { setPdfOcrProvider } from '../../../supabase/functions/_shared/statement/ocr.ts'
import { parseStatement } from '../../../supabase/functions/_shared/statement/parse.ts'
import type { ParseResult } from '../../../supabase/functions/_shared/statement/types.ts'
import type { StatementFileType, StatementImportStatus } from '@/types/database'

let browserOcrInstalled = false

function installBrowserPdfOcr() {
  if (browserOcrInstalled || typeof document === 'undefined') return
  browserOcrInstalled = true
  setPdfOcrProvider(async (input) => {
    const { recoverPdfText } = await import('./browserPdfOcr.ts')
    return recoverPdfText(input)
  })
}

export interface ProcessStatementSummary {
  importId: string
  status: StatementImportStatus
  inserted: number
  duplicates: number
  errors: number
  warnings: ParseResult['warnings']
}

function asSummary(value: unknown) {
  const row = (value ?? {}) as {
    inserted?: number
    duplicates?: number
    errors?: number
  }
  return {
    inserted: Number(row.inserted ?? 0),
    duplicates: Number(row.duplicates ?? 0),
    errors: Number(row.errors ?? 0),
  }
}

async function updateImport(
  importId: string,
  patch: Record<string, unknown>,
) {
  const { error } = await supabase
    .from('statement_imports')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', importId)
  if (error) throw error
}

function fileTypeFromParse(parsed: ParseResult): StatementFileType | undefined {
  if (parsed.format === 'unknown') return undefined
  return parsed.format
}

function toRpcTransactions(parsed: ParseResult) {
  return parsed.movements.map((item) => ({
    posted_at: item.postedAt,
    description: item.description,
    amount: item.amount,
    type: item.type,
    balance: item.balance,
    external_id: item.externalId,
    document_number: item.documentNumber,
    counterparty: item.counterparty,
    raw: item.raw,
  }))
}

export async function processStatementFile(input: {
  companyId: string
  importId: string
  fileName: string
  bytes: Uint8Array
}): Promise<ProcessStatementSummary> {
  try {
    installBrowserPdfOcr()
    await updateImport(input.importId, { status: 'identifying' })
    await updateImport(input.importId, { status: 'parsing' })

    statementLog('Processando extrato', {
      arquivo: input.fileName,
      bytes: input.bytes.byteLength,
    })
    const parsed = await parseStatement(input.fileName, input.bytes)
    statementLog('Leitura concluída', {
      formato: parsed.format,
      banco: parsed.bankName,
      lancamentos: parsed.movements.length,
      ocrPendente: parsed.ocrRequired,
      avisos: parsed.warnings.map((item) => item.message),
    })
    const detectedType = fileTypeFromParse(parsed)
    await updateImport(input.importId, {
      status: 'normalizing',
      ...(detectedType ? { file_type: detectedType } : {}),
      detected_bank: parsed.bankName,
    })

    if (parsed.ocrRequired) {
      const message =
        parsed.warnings[0]?.message ??
        'Não foi possível ler este PDF digitalizado. Envie OFX, CSV ou XLSX.'
      await updateImport(input.importId, {
        status: 'ocr_required',
        error_message: message,
        warnings: parsed.warnings,
        processed_at: new Date().toISOString(),
      })
      return {
        importId: input.importId,
        status: 'ocr_required',
        inserted: 0,
        duplicates: 0,
        errors: 0,
        warnings: parsed.warnings,
      }
    }

    if (parsed.movements.length === 0) {
      const message =
        parsed.warnings[0]?.message ??
        'Nenhum lançamento foi identificado neste arquivo.'
      await updateImport(input.importId, {
        status: 'failed',
        error_message: message,
        warnings: parsed.warnings,
        processed_at: new Date().toISOString(),
      })
      throw new Error(message)
    }

    if (parsed.movements.length > MAX_TRANSACTIONS) {
      throw new Error(
        `O extrato tem ${parsed.movements.length} lançamentos. O limite atual é ${MAX_TRANSACTIONS}.`,
      )
    }

    const { data: imported, error: rpcError } = await supabase.rpc(
      'import_actual_transactions',
      {
        p_company_id: input.companyId,
        p_import_id: input.importId,
        p_transactions: toRpcTransactions(parsed),
      },
    )

    if (rpcError) throw rpcError

    const summary = asSummary(imported)
    await updateImport(input.importId, {
      status: 'completed',
      file_type: fileTypeFromParse(parsed) ?? 'unknown',
      detected_bank: parsed.bankName,
      warnings: parsed.warnings,
      error_message: null,
      processed_at: new Date().toISOString(),
    })

    return {
      importId: input.importId,
      status: 'completed',
      ...summary,
      warnings: parsed.warnings,
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Falha ao processar o extrato.'
    statementError('Falha ao processar o extrato', error)
    await updateImport(input.importId, {
      status: 'failed',
      error_message: message,
      processed_at: new Date().toISOString(),
    }).catch(() => undefined)
    if (error instanceof Error) throw error
    throw new Error(message, { cause: error })
  }
}
