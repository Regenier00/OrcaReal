import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { MAX_ERP_BATCH, MAX_ERP_FILE_BYTES } from '../_shared/erp/limits.ts'
import { parseErpFile } from '../_shared/erp/parse.ts'

interface RequestBody {
  importId?: string
  companyId?: string
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function updateImport(
  client: ReturnType<typeof createClient>,
  importId: string,
  companyId: string,
  patch: Record<string, unknown>,
) {
  const { error } = await client
    .from('erp_imports')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', importId)
    .eq('company_id', companyId)
  if (error) throw error
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Método não permitido' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnon) {
    return json(500, { error: 'Configuração do servidor ausente' })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json(401, { error: 'Usuário não autenticado' })

  const client = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser()
  if (userError || !user) return json(401, { error: 'Usuário não autenticado' })

  let payload: RequestBody
  try {
    payload = (await req.json()) as RequestBody
  } catch {
    return json(400, { error: 'JSON inválido' })
  }

  const importId = payload.importId
  const companyId = payload.companyId
  if (!importId || !companyId) {
    return json(400, { error: 'Informe a importação e a empresa' })
  }

  const { data: membership } = await client
    .from('company_users')
    .select('id')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return json(403, { error: 'Sem acesso a esta empresa' })

  const { data: erpImport, error: importError } = await client
    .from('erp_imports')
    .select('id, company_id, file_path, file_name, mime_type, status')
    .eq('id', importId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (importError || !erpImport) {
    return json(404, { error: 'Importação não encontrada' })
  }

  if (!erpImport.file_path) {
    return json(400, { error: 'Arquivo ainda não foi enviado' })
  }

  try {
    await updateImport(client, importId, companyId, { status: 'validating' })

    const { data: file, error: downloadError } = await client.storage
      .from('erp-imports')
      .download(erpImport.file_path)

    if (downloadError || !file) {
      throw new Error('Não foi possível baixar o arquivo.')
    }

    const buffer = new Uint8Array(await file.arrayBuffer())
    if (buffer.byteLength > MAX_ERP_FILE_BYTES) {
      throw new Error('O arquivo excede o limite de 30 MB.')
    }

    await updateImport(client, importId, companyId, { status: 'parsing' })
    const parsed = await parseErpFile(
      erpImport.file_name,
      buffer,
      erpImport.mime_type,
    )

    if (parsed.entries.length === 0) {
      const message =
        parsed.warnings[0]?.message || 'Nenhum lançamento encontrado.'
      await updateImport(client, importId, companyId, {
        status: 'failed',
        file_type: parsed.format,
        detected_layout: parsed.layout ?? {},
        warnings: parsed.warnings,
        error_message: message,
        processed_at: new Date().toISOString(),
      })
      return json(422, { error: message, warnings: parsed.warnings })
    }

    await updateImport(client, importId, companyId, {
      status: 'classifying',
      file_type: parsed.format === 'unknown' ? 'unknown' : parsed.format,
      detected_layout: parsed.layout ?? {},
      warnings: parsed.warnings,
    })

    const payloadEntries = parsed.entries.map((item) => ({
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

    let inserted = 0
    let duplicates = 0
    let errors = 0

    for (let offset = 0; offset < payloadEntries.length; offset += MAX_ERP_BATCH) {
      const batch = payloadEntries.slice(offset, offset + MAX_ERP_BATCH)
      const { data, error } = await client.rpc('import_erp_entries', {
        p_company_id: companyId,
        p_import_id: importId,
        p_entries: batch,
      })
      if (error) throw error
      const row = (data ?? {}) as {
        inserted?: number
        duplicates?: number
        errors?: number
      }
      inserted += Number(row.inserted ?? 0)
      duplicates += Number(row.duplicates ?? 0)
      errors += Number(row.errors ?? 0)
    }

    await updateImport(client, importId, companyId, {
      status: 'completed',
      processed_at: new Date().toISOString(),
      error_message: null,
    })

    return json(200, {
      importId,
      inserted,
      duplicates,
      errors,
      warnings: parsed.warnings,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Falha ao processar o arquivo ERP.'
    await updateImport(client, importId, companyId, {
      status: 'failed',
      error_message: message,
      processed_at: new Date().toISOString(),
    }).catch(() => undefined)
    return json(500, { error: message })
  }
})
