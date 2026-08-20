import { supabase } from '@/lib/supabase'
import {
  costCentersForDepartment,
  loadCompanyStructure,
  type CompanyStructure,
} from '@/features/company/structureService'
import {
  fileTypeFromName,
  groupTransactionsBySuggestion,
  isDefaultBankAccount,
  MAX_STATEMENT_FILE_BYTES,
  type ClassifiedActualSlice,
} from '@/features/actual/model'
import { monthKey } from '@/features/budget/period'
import { processStatementFile } from '@/features/actual/processStatementFile'
import type {
  ActualTransaction,
  ActualTransactionStatus,
  ActualTransactionType,
  BankAccount,
  BudgetDestination,
  Category,
  DestinationMatchPatternRow,
  StatementImport,
  StatementImportStatus,
} from '@/types/database'

const IMPORT_SELECT = `
  id,
  company_id,
  bank_account_id,
  file_name,
  file_path,
  file_size,
  file_type,
  detected_bank,
  status,
  transaction_count,
  income_count,
  expense_count,
  transfer_count,
  classified_count,
  pending_count,
  ignored_count,
  error_count,
  duplicate_count,
  period_start,
  period_end,
  error_message,
  warnings,
  created_by,
  created_at,
  updated_at,
  processed_at
`

const TRANSACTION_SELECT = `
  id,
  company_id,
  bank_account_id,
  import_id,
  posted_at,
  description,
  amount,
  type,
  balance,
  category_id,
  department_id,
  cost_center_id,
  money_group,
  destination_id,
  destination_name,
  status,
  external_id,
  fingerprint,
  document_number,
  counterparty,
  suggested_category_id,
  suggested_department_id,
  suggested_cost_center_id,
  suggested_money_group,
  suggested_destination_id,
  suggested_destination_name,
  suggestion_source,
  classified_at,
  classified_by,
  created_at,
  updated_at
`

// actual_transactions has two FKs to departments and cost_centers
// (classified vs suggested). PostgREST needs the constraint name (PGRST201).
const CLASSIFIED_SLICE_SELECT = `
  posted_at,
  amount,
  type,
  department_id,
  cost_center_id,
  money_group,
  destination_id,
  destination_name,
  department:departments!actual_transactions_department_id_fkey(id, name),
  cost_center:cost_centers!actual_transactions_cost_center_id_fkey(id, name)
`

export interface ActualCatalog extends CompanyStructure {
  categories: Category[]
}

export interface ActualSummary {
  incomeTotal: number
  expenseTotal: number
  pendingCount: number
  classifiedCount: number
  ignoredCount: number
  transactionCount: number
}

export interface TransactionFilters {
  importId?: string
  status?: ActualTransactionStatus | ''
  search?: string
  dateFrom?: string
  dateTo?: string
}

function asWarnings(value: unknown): StatementImport['warnings'] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is { message: string; row?: number } => {
    return Boolean(item && typeof item === 'object' && 'message' in item)
  })
}

function mapImport(row: StatementImport): StatementImport {
  return { ...row, warnings: asWarnings(row.warnings) }
}

function storagePath(companyId: string, importId: string, fileName: string) {
  const safeName = fileName.replace(/[^\w.\-()+ ]+/g, '_').replace(/^\.+/, '').slice(0, 180)
  return `${companyId}/${importId}/${safeName || 'extrato'}`
}

export async function loadActualCatalog(companyId: string): Promise<ActualCatalog> {
  const structure = await loadCompanyStructure(companyId)
  const { data, error } = await supabase
    .from('categories')
    .select('id, company_id, name, category_type, parent_id, is_active')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name')

  if (error) {
    console.error('Erro ao carregar categorias:', error)
    throw new Error('Não foi possível carregar as categorias da empresa.')
  }

  return {
    ...structure,
    categories: (data ?? []) as Category[],
  }
}

export { costCentersForDepartment }

function readErrorText(error: unknown) {
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message ?? '')
      : error instanceof Error
        ? error.message
        : ''
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code: unknown }).code ?? '')
      : ''
  const details =
    error && typeof error === 'object' && 'details' in error
      ? String((error as { details: unknown }).details ?? '')
      : ''
  const hint =
    error && typeof error === 'object' && 'hint' in error
      ? String((error as { hint: unknown }).hint ?? '')
      : ''
  return {
    code,
    message,
    normalized: `${code} ${message} ${details} ${hint}`.toLowerCase(),
  }
}

function isMissingDbObject(error: unknown) {
  const { normalized } = readErrorText(error)
  return (
    normalized.includes('pgrst202') ||
    normalized.includes('pgrst205') ||
    normalized.includes('could not find the function') ||
    normalized.includes('could not find the table') ||
    normalized.includes('schema cache')
  )
}

function sortBankAccounts(accounts: BankAccount[]) {
  return [...accounts].sort((left, right) => {
    if (left.bank_code && right.bank_code && left.bank_code !== right.bank_code) {
      return left.bank_code.localeCompare(right.bank_code, 'pt-BR', {
        numeric: true,
      })
    }
    if (left.bank_code && !right.bank_code) return -1
    if (!left.bank_code && right.bank_code) return 1
    return left.name.localeCompare(right.name, 'pt-BR')
  })
}

function mapActualError(error: unknown, fallback: string) {
  const { message, normalized } = readErrorText(error)

  if (isMissingDbObject(error)) {
    return 'O banco do Realizado ainda não foi atualizado. Aplique as migrations e tente de novo.'
  }
  if (
    normalized.includes('pgrst116') ||
    normalized.includes('json object requested')
  ) {
    return 'A conta não pôde ser confirmada. Atualize a página e tente de novo.'
  }
  if (
    normalized.includes('42501') ||
    normalized.includes('row-level security') ||
    normalized.includes('permission denied')
  ) {
    return 'Você não tem permissão para essa ação nesta empresa.'
  }
  if (
    normalized.includes('jwt') ||
    normalized.includes('not authenticated') ||
    normalized.includes('usuário não autenticado')
  ) {
    return 'Sua sessão expirou. Entre novamente para continuar.'
  }
  if (normalized.includes('sem acesso')) {
    return 'Sem acesso a esta empresa.'
  }
  if (normalized.includes('apenas administradores')) {
    return 'Apenas administradores da empresa podem excluir extratos importados.'
  }
  if (normalized.includes('importação não encontrada')) {
    return 'Esse extrato já não está mais disponível.'
  }
  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('fetch failed')
  ) {
    return 'Falha de conexão. Verifique sua internet e tente de novo.'
  }
  if (message.trim()) return message
  return fallback
}

export async function listBankAccounts(companyId: string): Promise<BankAccount[]> {
  const { error: ensureError } = await supabase.rpc(
    'ensure_company_default_bank_accounts',
    { p_company_id: companyId },
  )
  if (ensureError) {
    console.error('Erro ao garantir contas bancárias padrão:', ensureError)
  }

  const { data, error } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name')

  if (error) {
    console.error('Erro ao listar contas bancárias:', error)
    throw new Error(mapActualError(error, 'Não foi possível carregar as contas bancárias.'))
  }

  return sortBankAccounts(
    ((data ?? []) as BankAccount[]).filter(isDefaultBankAccount),
  )
}

export async function listStatementImports(
  companyId: string,
): Promise<StatementImport[]> {
  const { data, error } = await supabase
    .from('statement_imports')
    .select(IMPORT_SELECT)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erro ao listar importações:', error)
    throw new Error('Não foi possível carregar as importações.')
  }

  return ((data ?? []) as StatementImport[]).map(mapImport)
}

export async function deleteStatementImport(
  companyId: string,
  importId: string,
): Promise<void> {
  const current = await getStatementImport(companyId, importId)

  const { error } = await supabase.rpc('delete_statement_import', {
    p_company_id: companyId,
    p_import_id: importId,
  })

  if (!error) {
    await removeStatementImportFile(current?.file_path)
    return
  }

  if (!isMissingDbObject(error)) {
    console.error('Erro ao excluir extrato via RPC:', error)
    throw new Error(mapActualError(error, 'Não foi possível excluir o extrato.'))
  }

  // Fallback sem RPC: remove todos os status (pending, classified, ignored).
  // A policy RLS exige admin da empresa — alinhada à RPC.
  const { error: transactionError } = await supabase
    .from('actual_transactions')
    .delete()
    .eq('company_id', companyId)
    .eq('import_id', importId)

  if (transactionError) {
    console.error('Erro ao excluir lançamentos do extrato:', transactionError)
    throw new Error(
      mapActualError(transactionError, 'Não foi possível excluir o extrato.'),
    )
  }

  const { count: remaining, error: remainingError } = await supabase
    .from('actual_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('import_id', importId)

  if (remainingError) {
    console.error('Erro ao verificar lançamentos restantes do extrato:', remainingError)
    throw new Error(
      mapActualError(remainingError, 'Não foi possível excluir o extrato.'),
    )
  }

  if ((remaining ?? 0) > 0) {
    throw new Error(
      'Não foi possível excluir todos os lançamentos deste extrato (incluindo apropriados).',
    )
  }

  const { error: importError } = await supabase
    .from('statement_imports')
    .delete()
    .eq('company_id', companyId)
    .eq('id', importId)

  if (importError) {
    console.error('Erro ao excluir extrato:', importError)
    throw new Error(mapActualError(importError, 'Não foi possível excluir o extrato.'))
  }

  await removeStatementImportFile(current?.file_path)
}

async function removeStatementImportFile(filePath?: string | null) {
  if (!filePath) return
  const { error } = await supabase.storage
    .from('statement-imports')
    .remove([filePath])
  if (error) {
    console.error('Erro ao excluir arquivo do extrato:', error)
  }
}

export async function getStatementImport(
  companyId: string,
  importId: string,
): Promise<StatementImport | null> {
  const { data, error } = await supabase
    .from('statement_imports')
    .select(IMPORT_SELECT)
    .eq('company_id', companyId)
    .eq('id', importId)
    .maybeSingle()

  if (error) {
    console.error('Erro ao carregar importação:', error)
    throw new Error('Não foi possível carregar a importação.')
  }

  return data ? mapImport(data as StatementImport) : null
}

export async function getActualSummary(companyId: string): Promise<ActualSummary> {
  const { data, error } = await supabase.rpc('actual_company_summary', {
    p_company_id: companyId,
  })

  if (error) {
    console.error('Erro ao carregar resumo do realizado:', error)
    throw new Error('Não foi possível carregar o resumo do realizado.')
  }

  const row = (data ?? {}) as {
    income_total?: number
    expense_total?: number
    pending_count?: number
    classified_count?: number
    ignored_count?: number
    transaction_count?: number
  }

  return {
    incomeTotal: Number(row.income_total ?? 0),
    expenseTotal: Number(row.expense_total ?? 0),
    pendingCount: Number(row.pending_count ?? 0),
    classifiedCount: Number(row.classified_count ?? 0),
    ignoredCount: Number(row.ignored_count ?? 0),
    transactionCount: Number(row.transaction_count ?? 0),
  }
}

export async function listActualTransactions(
  companyId: string,
  filters: TransactionFilters = {},
): Promise<ActualTransaction[]> {
  let query = supabase
    .from('actual_transactions')
    .select(TRANSACTION_SELECT)
    .eq('company_id', companyId)
    .order('posted_at', { ascending: false })
    .limit(500)

  if (filters.importId) query = query.eq('import_id', filters.importId)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.dateFrom) query = query.gte('posted_at', filters.dateFrom)
  if (filters.dateTo) query = query.lte('posted_at', filters.dateTo)
  if (filters.search?.trim()) {
    query = query.ilike('description', `%${filters.search.trim()}%`)
  }

  const { data, error } = await query
  if (error) {
    console.error('Erro ao listar movimentações:', error)
    throw new Error('Não foi possível carregar as movimentações.')
  }

  return ((data ?? []) as ActualTransaction[]).map((row) => ({
    ...row,
    amount: Number(row.amount),
    balance: row.balance == null ? null : Number(row.balance),
    destination_id: row.destination_id ?? null,
    destination_name: row.destination_name ?? null,
    suggested_destination_id: row.suggested_destination_id ?? null,
    suggested_destination_name: row.suggested_destination_name ?? null,
  }))
}

export async function listCompanyBudgetDestinations(
  companyId: string
): Promise<BudgetDestination[]> {
  const { data, error } = await supabase
    .from('budget_destinations')
    .select('id, company_id, money_group, name, is_active, created_at, updated_at')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('money_group')
    .order('name')

  if (error) {
    console.error('Erro ao listar destinos do orçamento:', error)
    throw new Error('Não foi possível carregar os destinos do orçamento.')
  }
  return (data as BudgetDestination[]) ?? []
}

export async function listDestinationMatchPatterns(
  companyId: string
): Promise<DestinationMatchPatternRow[]> {
  const { data, error } = await supabase
    .from('destination_match_patterns')
    .select(
      'id, company_id, match_type, match_value, money_group, destination_id, destination_name, usage_count, last_classified_at, created_at, updated_at'
    )
    .eq('company_id', companyId)
    .order('usage_count', { ascending: false })
    .limit(500)

  if (error) {
    // Tabela pode ainda não existir em ambientes sem a migration aplicada.
    console.warn('Não foi possível carregar padrões de destino:', error.message)
    return []
  }
  return (data as DestinationMatchPatternRow[]) ?? []
}

export async function listClassifiedActualSlices(
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
      .from('actual_transactions')
      .select(CLASSIFIED_SLICE_SELECT)
      .eq('company_id', companyId)
      .eq('status', 'classified')
      .gte('posted_at', startDate)
      .lte('posted_at', endDate)
      .or('cost_center_id.not.is.null,money_group.not.is.null')
      .order('posted_at', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      console.error('Erro ao carregar realizados apropriados:', error)
      throw new Error('Não foi possível carregar os lançamentos apropriados.')
    }

    const rows = data ?? []
    for (const row of rows) {
      const costCenter = asNamedRef(row.cost_center)
      const department = asNamedRef(row.department)
      const moneyGroup = (row.money_group as string | null) ?? null
      const destinationName =
        (row.destination_name as string | null)?.trim() || null
      const destinationId = (row.destination_id as string | null) ?? null
      const costCenterId =
        costCenter?.id ||
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
        departmentId:
          (row.department_id as string | null) ??
          department?.id ??
          moneyGroup,
        costCenterId,
        departmentName: department?.name || groupLabel || 'Grupo',
        costCenterName:
          costCenter?.name || destinationName || groupLabel || 'Grupo',
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

function asNamedRef(value: unknown): { id: string; name: string } | null {
  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== 'object') return null
  const item = row as { id?: unknown; name?: unknown }
  if (typeof item.id !== 'string' || typeof item.name !== 'string') return null
  return { id: item.id, name: item.name }
}

export async function classifyActualTransactions(input: {
  companyId: string
  transactionIds: string[]
  departmentId?: string | null
  categoryId?: string | null
  costCenterId?: string | null
  moneyGroup?: string | null
  destinationId?: string | null
  destinationName?: string | null
  status?: ActualTransactionStatus
  type?: ActualTransactionType | null
}): Promise<number> {
  if (input.transactionIds.length === 0) return 0

  const payload: Record<string, unknown> = {
    p_company_id: input.companyId,
    p_transaction_ids: input.transactionIds,
    p_department_id: input.departmentId || null,
    p_category_id: input.categoryId || null,
    p_cost_center_id: input.costCenterId || null,
    p_status: input.status ?? 'classified',
    p_type: input.type || null,
    p_money_group: input.moneyGroup || null,
  }

  if (input.destinationId || input.destinationName) {
    payload.p_destination_id = input.destinationId || null
    payload.p_destination_name = input.destinationName || null
  }

  const { data, error } = await supabase.rpc('classify_actual_transactions', payload)

  if (error) {
    console.error('Erro ao classificar movimentações:', error)
    throw new Error(error.message || 'Não foi possível classificar as movimentações.')
  }

  return (data as number) ?? 0
}

export async function applyTransactionSuggestions(input: {
  companyId: string
  transactions: ActualTransaction[]
}): Promise<number> {
  const groups = groupTransactionsBySuggestion(input.transactions)
  if (groups.length === 0) return 0

  let updated = 0
  for (const group of groups) {
    updated += await classifyActualTransactions({
      companyId: input.companyId,
      transactionIds: group.transactionIds,
      departmentId: group.departmentId,
      categoryId: group.categoryId,
      costCenterId: group.costCenterId,
      moneyGroup: group.moneyGroup,
      destinationId: group.destinationId,
      destinationName: group.destinationName,
      status: 'classified',
    })
  }
  return updated
}

export async function uploadAndProcessStatement(input: {
  companyId: string
  bankAccountId: string
  file: File
  userId: string
}): Promise<StatementImport> {
  const fileType = fileTypeFromName(input.file.name)
  if (fileType === 'unknown') {
    throw new Error('Envie um arquivo OFX, CSV, XLSX ou PDF.')
  }
  if (input.file.size > MAX_STATEMENT_FILE_BYTES) {
    throw new Error('O arquivo excede o limite de 20 MB.')
  }

  const { data: created, error: createError } = await supabase
    .from('statement_imports')
    .insert({
      company_id: input.companyId,
      bank_account_id: input.bankAccountId,
      file_name: input.file.name,
      file_size: input.file.size,
      file_type: fileType,
      status: 'uploaded',
      created_by: input.userId,
    })
    .select(IMPORT_SELECT)
    .single()

  if (createError || !created) {
    console.error('Erro ao registrar importação:', createError)
    throw new Error('Não foi possível iniciar a importação.')
  }

  const importRow = mapImport(created as StatementImport)
  const path = storagePath(input.companyId, importRow.id, input.file.name)

  const { error: uploadError } = await supabase.storage
    .from('statement-imports')
    .upload(path, input.file, {
      contentType: 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) {
    console.error('Erro ao enviar arquivo:', uploadError)
    await supabase
      .from('statement_imports')
      .update({
        status: 'failed',
        error_message: 'Falha ao enviar o arquivo para o armazenamento.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', importRow.id)
    throw new Error('Não foi possível enviar o arquivo. Tente novamente.')
  }

  const { error: pathError } = await supabase
    .from('statement_imports')
    .update({ file_path: path, updated_at: new Date().toISOString() })
    .eq('id', importRow.id)

  if (pathError) {
    throw new Error('O arquivo foi enviado, mas a importação não pôde ser atualizada.')
  }

  const bytes = new Uint8Array(await input.file.arrayBuffer())
  await processStatementFile({
    companyId: input.companyId,
    importId: importRow.id,
    fileName: input.file.name,
    bytes,
  })

  const latest = await getStatementImport(input.companyId, importRow.id)
  return latest ?? importRow
}

export async function pollStatementImport(
  companyId: string,
  importId: string,
  onUpdate: (item: StatementImport) => void,
): Promise<StatementImport> {
  const terminal: StatementImportStatus[] = [
    'completed',
    'failed',
    'ocr_required',
  ]

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const current = await getStatementImport(companyId, importId)
    if (!current) throw new Error('Importação não encontrada.')
    onUpdate(current)
    if (terminal.includes(current.status)) return current
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  const last = await getStatementImport(companyId, importId)
  if (!last) throw new Error('Importação não encontrada.')
  return last
}

export {
  deleteCompanyActual,
  getCompanyActual,
  getCompanyActualByBudget,
  listCompanyActuals,
  saveCompanyActual,
} from '@/features/actual/periodActualService'
