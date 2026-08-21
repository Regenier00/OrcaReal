import {
  API_KEY_STRIPPED_MESSAGE,
  enrichSupabaseError,
  INVALID_API_KEY_MESSAGE,
  mapSupabaseError,
  MISSING_API_KEY_REQUEST_MESSAGE,
} from '@/features/auth/authErrors'
import { supabase, isSupabaseConfigured, getSupabaseRuntimeInfo } from '@/lib/supabase'
import { isCompanyScopedStoragePath } from '@/lib/storagePath'
import type { ClassifiedActualSlice } from '@/features/actual/model'
import { monthKey } from '@/features/budget/period'
import {
  assertCanImportWithBudget,
  companyHasBudgets,
  BUDGET_REQUIRED_FOR_IMPORT_MESSAGE,
} from '@/features/budget/budgetGate'
import {
  assertCanImportWithChartAccounts,
  companyHasChartAccounts,
  CHART_ACCOUNTS_REQUIRED_FOR_IMPORT_MESSAGE,
} from '@/features/erp/chartAccountGate'
import {
  erpFileTypeFromName,
  isAcceptedErpFile,
  MAX_ERP_FILE_BYTES,
} from '@/features/erp/model'
import { processErpFile } from '@/features/erp/processErpFile'
import type {
  ActualTransactionType,
  ErpEntry,
  ErpEntryStatus,
  ErpImport,
  MoneyGroup,
} from '@/types/database'

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
  entry_count,
  classified_count,
  pending_count,
  ignored_count,
  error_count,
  duplicate_count,
  revenue_count,
  cost_count,
  expense_count,
  investment_count,
  period_start,
  period_end,
  error_message,
  warnings,
  created_by,
  created_at,
  updated_at,
  processed_at
`

const ENTRY_SELECT = `
  id,
  company_id,
  import_id,
  posted_at,
  description,
  amount,
  entry_side,
  type,
  account_code,
  account_name,
  cost_center_code,
  cost_center_name,
  department_name,
  document_number,
  external_id,
  fingerprint,
  department_id,
  cost_center_id,
  money_group,
  destination_id,
  destination_name,
  status,
  suggested_money_group,
  suggested_destination_id,
  suggested_destination_name,
  suggested_department_id,
  suggested_cost_center_id,
  suggestion_source,
  classified_at,
  classified_by,
  created_at,
  updated_at
`

function asWarnings(value: unknown): ErpImport['warnings'] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is { message: string; row?: number } => {
    return Boolean(item && typeof item === 'object' && 'message' in item)
  })
}

function mapImport(row: ErpImport): ErpImport {
  return {
    ...row,
    warnings: asWarnings(row.warnings),
    detected_layout:
      row.detected_layout && typeof row.detected_layout === 'object'
        ? row.detected_layout
        : {},
  }
}

function storagePath(companyId: string, importId: string, fileName: string) {
  const safeName = fileName
    .replace(/[^\w.\-()+ ]+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 180)
  return `${companyId}/${importId}/${safeName || 'erp'}`
}

async function sha256Hex(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes)
  const digest = await crypto.subtle.digest('SHA-256', copy)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function listErpImports(companyId: string): Promise<ErpImport[]> {
  const { data, error } = await supabase
    .from('erp_imports')
    .select(IMPORT_SELECT)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Erro ao listar importações ERP:', error)
    throw new Error('Não foi possível carregar as importações de ERP.')
  }

  return (data ?? []).map((row) => mapImport(row as ErpImport))
}

export async function getErpImport(
  companyId: string,
  importId: string,
): Promise<ErpImport | null> {
  const { data, error } = await supabase
    .from('erp_imports')
    .select(IMPORT_SELECT)
    .eq('company_id', companyId)
    .eq('id', importId)
    .maybeSingle()

  if (error) {
    console.error('Erro ao carregar importação ERP:', error)
    throw new Error('Não foi possível carregar a importação.')
  }
  return data ? mapImport(data as ErpImport) : null
}

export async function pollErpImport(
  companyId: string,
  importId: string,
  onUpdate?: (row: ErpImport) => void,
): Promise<ErpImport> {
  for (let i = 0; i < 60; i += 1) {
    const row = await getErpImport(companyId, importId)
    if (!row) throw new Error('Importação não encontrada.')
    onUpdate?.(row)
    if (
      row.status === 'completed' ||
      row.status === 'failed'
    ) {
      return row
    }
    await new Promise((resolve) => setTimeout(resolve, 800))
  }
  const last = await getErpImport(companyId, importId)
  if (!last) throw new Error('Importação não encontrada.')
  return last
}

function mapErpImportCreateError(error: { message?: string } | null) {
  const message = error?.message ?? ''
  if (message.includes('classificação das contas contábeis')) {
    return CHART_ACCOUNTS_REQUIRED_FOR_IMPORT_MESSAGE
  }
  if (message.includes('Crie um orçamento antes de importar')) {
    return BUDGET_REQUIRED_FOR_IMPORT_MESSAGE
  }
  const mapped = enrichSupabaseError(
    error,
    getSupabaseRuntimeInfo(),
    'Não foi possível iniciar a importação.',
  )
  if (
    mapped === MISSING_API_KEY_REQUEST_MESSAGE ||
    mapped === INVALID_API_KEY_MESSAGE ||
    mapped.startsWith(API_KEY_STRIPPED_MESSAGE)
  ) {
    return mapped
  }
  return 'Não foi possível iniciar a importação.'
}

export async function uploadAndProcessErpImport(input: {
  companyId: string
  file: File
  userId: string
}): Promise<ErpImport> {
  if (!isSupabaseConfigured) {
    throw new Error(MISSING_API_KEY_REQUEST_MESSAGE)
  }
  if (!isAcceptedErpFile(input.file.name)) {
    throw new Error('Envie um arquivo XLSX ou CSV.')
  }
  if (input.file.size > MAX_ERP_FILE_BYTES) {
    throw new Error('O arquivo excede o limite de 20 MB.')
  }
  if (input.file.size === 0) {
    throw new Error('O arquivo enviado está vazio.')
  }

  assertCanImportWithChartAccounts(await companyHasChartAccounts(input.companyId))
  assertCanImportWithBudget(await companyHasBudgets(input.companyId))

  const bytes = new Uint8Array(await input.file.arrayBuffer())
  const fileHash = await sha256Hex(bytes)
  const fileType = erpFileTypeFromName(input.file.name)

  const { data: created, error: createError } = await supabase
    .from('erp_imports')
    .insert({
      company_id: input.companyId,
      file_name: input.file.name,
      file_size: input.file.size,
      file_type: fileType,
      mime_type: input.file.type || null,
      file_hash: fileHash,
      status: 'uploaded',
      created_by: input.userId,
    })
    .select(IMPORT_SELECT)
    .single()

  if (createError || !created) {
    console.error('Erro ao criar importação ERP:', createError)
    throw new Error(mapErpImportCreateError(createError))
  }

  const row = mapImport(created as ErpImport)
  const path = storagePath(input.companyId, row.id, input.file.name)

  const { error: uploadError } = await supabase.storage
    .from('erp-imports')
    .upload(path, input.file, {
      contentType: input.file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) {
    // O arquivo já está em memória para processErpFile. Não derruba a
    // importação se só o Storage falhar (ex.: bucket/política), desde que
    // REST/RPC sigam ok.
    console.warn(
      'Upload Storage do ERP falhou; seguindo com processamento local:',
      uploadError,
    )
  } else {
    await supabase
      .from('erp_imports')
      .update({
        file_path: path,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('company_id', input.companyId)
  }

  // Processamento local em lotes — evita timeout no frontend em volumes altos.
  await processErpFile({
    companyId: input.companyId,
    importId: row.id,
    fileName: input.file.name,
    bytes,
    mimeType: input.file.type || null,
  })

  const finished = await getErpImport(input.companyId, row.id)
  if (!finished) throw new Error('Importação não encontrada após o processamento.')
  return finished
}

export async function deleteErpImport(companyId: string, importId: string) {
  const current = await getErpImport(companyId, importId)

  const { error } = await supabase.rpc('delete_erp_import', {
    p_company_id: companyId,
    p_import_id: importId,
  })
  if (error) {
    console.error('Erro ao excluir importação ERP:', error)
    throw new Error(mapErpDeleteError(error))
  }

  // Arquivo sai pela Storage API (RLS: só admin da empresa no path company/import/…).
  await removeErpImportFile(companyId, current?.file_path)
}

function mapErpDeleteError(error: unknown) {
  const mapped = mapSupabaseError(error, '')
  if (mapped === MISSING_API_KEY_REQUEST_MESSAGE) return mapped

  const message = mapped
  const normalized = message.toLowerCase()

  if (normalized.includes('apenas administradores')) {
    return 'Apenas administradores da empresa podem excluir importações ERP.'
  }
  if (normalized.includes('sem acesso')) {
    return 'Sem acesso a esta empresa.'
  }
  if (normalized.includes('não encontrada') || normalized.includes('nao encontrada')) {
    return 'Essa importação já não está mais disponível.'
  }
  if (
    normalized.includes('usuário não autenticado') ||
    normalized.includes('not authenticated') ||
    normalized.includes('sessão expirou')
  ) {
    return 'Sua sessão expirou. Entre novamente para continuar.'
  }
  if (
    normalized.includes('direct deletion from storage') ||
    normalized.includes('use the storage api')
  ) {
    return 'Não foi possível excluir a importação. Atualize o banco (migration de storage) e tente de novo.'
  }
  return message.trim() || 'Não foi possível excluir a importação.'
}

async function removeErpImportFile(
  companyId: string,
  filePath?: string | null,
) {
  if (!isCompanyScopedStoragePath(companyId, filePath)) return
  const { error } = await supabase.storage.from('erp-imports').remove([filePath])
  if (error) {
    // Dados já foram removidos pela RPC; falha no arquivo não reverte a exclusão.
    console.error('Erro ao excluir arquivo ERP via Storage API:', error)
  }
}

export interface ErpEntryFilters {
  importId?: string
  status?: ErpEntryStatus | ''
  search?: string
  dateFrom?: string
  dateTo?: string
}

export async function listErpEntries(
  companyId: string,
  filters: ErpEntryFilters = {},
): Promise<ErpEntry[]> {
  let query = supabase
    .from('erp_entries')
    .select(ENTRY_SELECT)
    .eq('company_id', companyId)
    .order('posted_at', { ascending: false })
    .limit(500)

  if (filters.importId) query = query.eq('import_id', filters.importId)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.dateFrom) query = query.gte('posted_at', filters.dateFrom)
  if (filters.dateTo) query = query.lte('posted_at', filters.dateTo)
  if (filters.search?.trim()) {
    const term = filters.search.trim().replace(/%/g, '')
    query = query.or(
      `description.ilike.%${term}%,account_code.ilike.%${term}%,account_name.ilike.%${term}%,cost_center_name.ilike.%${term}%`,
    )
  }

  const { data, error } = await query
  if (error) {
    console.error('Erro ao listar lançamentos ERP:', error)
    throw new Error('Não foi possível carregar os lançamentos do ERP.')
  }
  return (data ?? []) as ErpEntry[]
}

export async function classifyErpEntries(input: {
  companyId: string
  entryIds: string[]
  moneyGroup?: MoneyGroup | null
  destinationId?: string | null
  destinationName?: string | null
  departmentId?: string | null
  costCenterId?: string | null
  status?: ErpEntryStatus
  type?: ActualTransactionType | null
  saveRules?: boolean
}): Promise<number> {
  const { data, error } = await supabase.rpc('classify_erp_entries', {
    p_company_id: input.companyId,
    p_entry_ids: input.entryIds,
    p_money_group: input.moneyGroup ?? null,
    p_destination_id: input.destinationId ?? null,
    p_destination_name: input.destinationName ?? null,
    p_department_id: input.departmentId ?? null,
    p_cost_center_id: input.costCenterId ?? null,
    p_status: input.status ?? 'classified',
    p_type: input.type ?? null,
    p_save_rules: input.saveRules ?? true,
  })

  if (error) {
    console.error('Erro ao classificar lançamentos ERP:', error)
    throw new Error(
      mapSupabaseError(error, 'Não foi possível classificar os lançamentos.'),
    )
  }
  return Number(data ?? 0)
}

export async function listClassifiedErpSlices(
  companyId: string,
  startDate: string,
  endDate: string,
): Promise<ClassifiedActualSlice[]> {
  const pageSize = 1000
  const slices: ClassifiedActualSlice[] = []
  let from = 0

  const moneyGroupLabel: Record<string, string> = {
    revenue: 'Receitas',
    cost: 'Custos',
    expense: 'Despesas',
    investment: 'Investimentos',
  }

  while (true) {
    const { data, error } = await supabase
      .from('erp_entries')
      .select(
        `
        posted_at,
        amount,
        type,
        department_id,
        cost_center_id,
        money_group,
        destination_id,
        destination_name,
        cost_center_name,
        department_name
      `,
      )
      .eq('company_id', companyId)
      .eq('status', 'classified')
      .gte('posted_at', startDate)
      .lte('posted_at', endDate)
      .not('money_group', 'is', null)
      .order('posted_at', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      console.error('Erro ao carregar realizados ERP:', error)
      throw new Error('Não foi possível carregar os lançamentos ERP apropriados.')
    }

    const rows = data ?? []
    for (const row of rows) {
      const moneyGroup = (row.money_group as string | null) ?? null
      const destinationName =
        (row.destination_name as string | null)?.trim() || null
      const destinationId = (row.destination_id as string | null) ?? null
      const costCenterId =
        (row.cost_center_id as string | null) ||
        destinationId ||
        destinationName ||
        moneyGroup
      if (!costCenterId) continue

      const postedAt = String(row.posted_at ?? '')
      const match = /^(\d{4})-(\d{2})/.exec(postedAt)
      if (!match) continue

      const groupLabel = moneyGroup ? moneyGroupLabel[moneyGroup] ?? moneyGroup : null

      slices.push({
        departmentId: (row.department_id as string | null) ?? moneyGroup,
        costCenterId,
        departmentName:
          (row.department_name as string | null) || groupLabel || 'Grupo',
        costCenterName:
          (row.cost_center_name as string | null) ||
          destinationName ||
          groupLabel ||
          'Grupo',
        moneyGroup,
        destinationId,
        destinationName,
        monthKey: monthKey(Number(match[1]), Number(match[2])),
        amount: Number(row.amount),
        type: (row.type as ActualTransactionType) ?? 'unknown',
      })
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  return slices
}
