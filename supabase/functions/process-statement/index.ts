import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { MAX_STATEMENT_BYTES, MAX_TRANSACTIONS } from '../_shared/statement/limits.ts'
import { parseStatement } from '../_shared/statement/parse.ts'

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
  patch: Record<string, unknown>,
) {
  const { error } = await client
    .from('statement_imports')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', importId)
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

  const { data: statementImport, error: importError } = await client
    .from('statement_imports')
    .select('id, company_id, file_path, file_name, file_type, status')
    .eq('id', importId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (importError || !statementImport) {
    return json(404, { error: 'Importação não encontrada' })
  }

  if (!statementImport.file_path) {
    return json(400, { error: 'Arquivo ainda não foi enviado' })
  }

  try {
    await updateImport(client, importId, { status: 'identifying' })

    const { data: file, error: downloadError } = await client.storage
      .from('statement-imports')
      .download(statementImport.file_path)

    if (downloadError || !file) {
      throw new Error('Não foi possível ler o arquivo importado.')
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    if (bytes.byteLength > MAX_STATEMENT_BYTES) {
      throw new Error('O arquivo excede o limite de 20 MB.')
    }
    await updateImport(client, importId, { status: 'parsing' })

    const parsed = await parseStatement(statementImport.file_name, bytes)
    await updateImport(client, importId, {
      status: 'normalizing',
      file_type: parsed.format === 'unknown' ? statementImport.file_type : parsed.format,
      detected_bank: parsed.bankName,
    })

    if (parsed.ocrRequired) {
      await updateImport(client, importId, {
        status: 'ocr_required',
        error_message:
          parsed.warnings[0]?.message ??
          'Este PDF precisa de OCR, que ainda não está disponível.',
        warnings: parsed.warnings,
        processed_at: new Date().toISOString(),
      })
      return json(200, {
        importId,
        status: 'ocr_required',
        inserted: 0,
        duplicates: 0,
        errors: 0,
        warnings: parsed.warnings,
      })
    }

    if (parsed.movements.length === 0) {
      await updateImport(client, importId, {
        status: 'failed',
        error_message:
          parsed.warnings[0]?.message ??
          'Nenhum lançamento foi identificado neste arquivo.',
        warnings: parsed.warnings,
        processed_at: new Date().toISOString(),
      })
      return json(200, {
        importId,
        status: 'failed',
        inserted: 0,
        duplicates: 0,
        errors: 0,
        warnings: parsed.warnings,
      })
    }

    if (parsed.movements.length > MAX_TRANSACTIONS) {
      throw new Error(
        `O extrato tem ${parsed.movements.length} lançamentos. O limite atual é ${MAX_TRANSACTIONS}.`,
      )
    }

    const { data: imported, error: rpcError } = await client.rpc(
      'import_actual_transactions',
      {
        p_company_id: companyId,
        p_import_id: importId,
        p_transactions: parsed.movements.map((item) => ({
          posted_at: item.postedAt,
          description: item.description,
          amount: item.amount,
          type: item.type,
          balance: item.balance,
          external_id: item.externalId,
          document_number: item.documentNumber,
          counterparty: item.counterparty,
          raw: item.raw,
        })),
      },
    )

    if (rpcError) throw rpcError

    const summary = (imported ?? {}) as {
      inserted?: number
      duplicates?: number
      errors?: number
    }

    await updateImport(client, importId, {
      status: 'completed',
      file_type: parsed.format === 'unknown' ? 'unknown' : parsed.format,
      detected_bank: parsed.bankName,
      warnings: parsed.warnings,
      error_message: null,
      processed_at: new Date().toISOString(),
    })

    return json(200, {
      importId,
      status: 'completed',
      format: parsed.format,
      bankName: parsed.bankName,
      inserted: summary.inserted ?? 0,
      duplicates: summary.duplicates ?? 0,
      errors: summary.errors ?? 0,
      warnings: parsed.warnings,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Falha ao processar o extrato.'
    await updateImport(client, importId, {
      status: 'failed',
      error_message: message,
      processed_at: new Date().toISOString(),
    }).catch(() => undefined)

    return json(500, { error: message })
  }
})
