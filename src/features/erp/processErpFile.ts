import { supabase } from '@/lib/supabase'
import { MAX_ERP_BATCH } from '../../../supabase/functions/_shared/erp/limits.ts'
import { parseErpFile } from '../../../supabase/functions/_shared/erp/parse.ts'
import type { ErpParseResult } from '../../../supabase/functions/_shared/erp/types.ts'
import type { ErpFileType, ErpImportStatus } from '@/types/database'

export interface ProcessErpSummary {
  importId: string
  status: ErpImportStatus
  inserted: number
  duplicates: number
  errors: number
  warnings: ErpParseResult['warnings']
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
  companyId: string,
  patch: Record<string, unknown>,
) {
  const { error } = await supabase
    .from('erp_imports')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', importId)
    .eq('company_id', companyId)
  if (error) throw error
}

function yieldToMain() {
  return new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve())
      return
    }
    setTimeout(() => resolve(), 0)
  })
}

function toRpcEntries(parsed: ErpParseResult) {
  return parsed.entries.map((item) => ({
    posted_at: item.postedAt,
    description: item.description,
    amount: item.amount,
    entry_side: item.entrySide,
    type: item.type,
    account_code: item.accountCode,
    account_name: item.accountName,
    cost_center_code: item.costCenterCode,
    cost_center_name: item.costCenterName,
    department_name: item.departmentName,
    document_number: item.documentNumber,
    external_id: item.externalId,
    suggested_money_group: item.suggestedMoneyGroup,
    suggested_destination_name: item.suggestedDestinationName,
    suggestion_source: item.suggestionSource,
    raw: item.raw,
  }))
}

export async function processErpFile(input: {
  companyId: string
  importId: string
  fileName: string
  bytes: Uint8Array
  mimeType?: string | null
}): Promise<ProcessErpSummary> {
  try {
    await updateImport(input.importId, input.companyId, {
      status: 'validating',
    })

    await updateImport(input.importId, input.companyId, {
      status: 'identifying',
    })

    await updateImport(input.importId, input.companyId, {
      status: 'parsing',
    })

    const parsed = await parseErpFile(
      input.fileName,
      input.bytes,
      input.mimeType,
    )

    const fileType: ErpFileType | undefined =
      parsed.format === 'unknown' ? undefined : parsed.format

    if (parsed.entries.length === 0) {
      const message =
        parsed.warnings[0]?.message ||
        'Nenhum lançamento encontrado no arquivo.'
      await updateImport(input.importId, input.companyId, {
        status: 'failed',
        file_type: fileType ?? 'unknown',
        detected_layout: parsed.layout ?? {},
        warnings: parsed.warnings,
        error_message: message,
        processed_at: new Date().toISOString(),
      })
      return {
        importId: input.importId,
        status: 'failed',
        inserted: 0,
        duplicates: 0,
        errors: 1,
        warnings: parsed.warnings,
      }
    }

    await updateImport(input.importId, input.companyId, {
      status: 'normalizing',
      file_type: fileType ?? 'unknown',
      detected_layout: parsed.layout ?? {},
      warnings: parsed.warnings,
    })

    const payload = toRpcEntries(parsed)
    let inserted = 0
    let duplicates = 0
    let errors = 0

    await updateImport(input.importId, input.companyId, {
      status: 'classifying',
    })

    for (let offset = 0; offset < payload.length; offset += MAX_ERP_BATCH) {
      const batch = payload.slice(offset, offset + MAX_ERP_BATCH)
      const { data, error } = await supabase.rpc('import_erp_entries', {
        p_company_id: input.companyId,
        p_import_id: input.importId,
        p_entries: batch,
      })
      if (error) throw error
      const summary = asSummary(data)
      inserted += summary.inserted
      duplicates += summary.duplicates
      errors += summary.errors
      await yieldToMain()
    }

    await updateImport(input.importId, input.companyId, {
      status: 'completed',
      processed_at: new Date().toISOString(),
      error_message: null,
    })

    return {
      importId: input.importId,
      status: 'completed',
      inserted,
      duplicates,
      errors,
      warnings: parsed.warnings,
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Falha ao processar o arquivo ERP.'
    await updateImport(input.importId, input.companyId, {
      status: 'failed',
      error_message: message,
      processed_at: new Date().toISOString(),
    }).catch(() => undefined)
    return {
      importId: input.importId,
      status: 'failed',
      inserted: 0,
      duplicates: 0,
      errors: 1,
      warnings: [{ message }],
    }
  }
}
