import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { assertSafeCostCenterXlsx } from '../_shared/costCenters/inspect.ts'
import { MAX_COST_CENTER_FILE_BYTES } from '../_shared/costCenters/limits.ts'
import { parseCostCenterXlsx } from '../_shared/costCenters/parse.ts'

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function safeFileName(name: string) {
  return name
    .replace(/[^\w.\-()+ ]+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 180) || 'centros-custo.xlsx'
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
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

  let companyId = ''
  let fileName = ''
  let mimeType: string | null = null
  let bytes: Uint8Array

  try {
    const contentType = req.headers.get('content-type') ?? ''
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return json(400, {
        error: 'Envie o arquivo como multipart/form-data (campo file).',
      })
    }

    const form = await req.formData()
    companyId = String(form.get('companyId') ?? '').trim()
    const file = form.get('file')

    if (!companyId) {
      return json(400, { error: 'Informe a empresa' })
    }
    if (!(file instanceof File)) {
      return json(400, { error: 'Arquivo não enviado' })
    }

    fileName = file.name || 'centros-custo.xlsx'
    mimeType = file.type || null

    // Content-Length / File.size can be spoofed; always measure bytes.
    if (file.size > MAX_COST_CENTER_FILE_BYTES) {
      return json(413, { error: 'O arquivo excede o limite de 5 MB.' })
    }

    bytes = new Uint8Array(await file.arrayBuffer())
    assertSafeCostCenterXlsx({ fileName, mimeType, bytes })
  } catch (error) {
    return json(400, {
      error: error instanceof Error ? error.message : 'Arquivo inválido',
    })
  }

  const { data: membership } = await client
    .from('company_users')
    .select('id, role')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return json(403, { error: 'Sem acesso a esta empresa' })
  if (!['owner', 'admin'].includes(String(membership.role))) {
    return json(403, {
      error: 'Somente administradores podem importar centros de custo',
    })
  }

  const fileHash = await sha256Hex(bytes)
  const { data: created, error: createError } = await client
    .from('cost_center_imports')
    .insert({
      company_id: companyId,
      file_name: fileName.slice(0, 240),
      file_size: bytes.byteLength,
      file_type: 'xlsx',
      mime_type: mimeType,
      file_hash: fileHash,
      status: 'validating',
      created_by: user.id,
    })
    .select('id')
    .single()

  if (createError || !created) {
    return json(400, {
      error: createError?.message || 'Não foi possível registrar a importação',
    })
  }

  const importId = created.id as string
  const path = `${companyId}/${importId}/${safeFileName(fileName)}`

  try {
    const { error: uploadError } = await client.storage
      .from('cost-center-imports')
      .upload(path, bytes, {
        contentType:
          mimeType ||
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: false,
      })

    if (uploadError) {
      throw new Error(uploadError.message || 'Falha ao armazenar o arquivo')
    }

    await client
      .from('cost_center_imports')
      .update({
        file_path: path,
        status: 'parsing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', importId)
      .eq('company_id', companyId)

    const parsed = await parseCostCenterXlsx(bytes)

    await client
      .from('cost_center_imports')
      .update({
        status: 'importing',
        detected_layout: parsed.layout,
        warnings: parsed.warnings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', importId)
      .eq('company_id', companyId)

    const { data: rpcResult, error: rpcError } = await client.rpc(
      'import_company_cost_centers',
      {
        p_company_id: companyId,
        p_import_id: importId,
        p_rows: parsed.rows.map((row) => ({
          name: row.name,
          code: row.code,
          description: row.description,
          row: row.row,
        })),
      },
    )

    if (rpcError) {
      throw new Error(rpcError.message || 'Falha ao gravar centros de custo')
    }

    const summary = (rpcResult ?? {}) as {
      inserted?: number
      updated?: number
      skipped?: number
      destinations_ensured?: number
      total?: number
    }

    const { data: finished } = await client
      .from('cost_center_imports')
      .select(
        'id, company_id, file_name, status, inserted_count, updated_count, skipped_count, row_count, destinations_ensured, error_message, warnings, processed_at',
      )
      .eq('id', importId)
      .eq('company_id', companyId)
      .maybeSingle()

    return json(200, {
      import: finished,
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
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Falha ao processar o arquivo'

    await client
      .from('cost_center_imports')
      .update({
        status: 'failed',
        error_message: message.slice(0, 500),
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', importId)
      .eq('company_id', companyId)

    return json(422, { error: message, importId })
  }
})
