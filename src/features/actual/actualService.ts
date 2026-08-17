import { supabase } from '@/lib/supabase'
import {
  costCentersForDepartment,
  loadCompanyStructure,
  type CompanyStructure,
} from '@/features/company/structureService'
import { fileTypeFromName, MAX_STATEMENT_FILE_BYTES } from '@/features/actual/model'
import type {
  ActualTransaction,
  ActualTransactionStatus,
  ActualTransactionType,
  BankAccount,
  Category,
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
  status,
  external_id,
  fingerprint,
  document_number,
  counterparty,
  suggested_category_id,
  suggested_department_id,
  suggested_cost_center_id,
  suggestion_source,
  classified_at,
  classified_by,
  created_at,
  updated_at
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
  type?: ActualTransactionType | ''
  departmentId?: string
  search?: string
  dateFrom?: string
  dateTo?: string
}

export interface ProcessStatementResult {
  importId: string
  status: StatementImportStatus
  inserted?: number
  duplicates?: number
  errors?: number
  warnings?: Array<{ message: string; row?: number }>
  error?: string
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

function asBankAccount(value: unknown): BankAccount | null {
  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== 'object') return null
  const item = row as Partial<BankAccount>
  if (typeof item.id !== 'string' || typeof item.name !== 'string') return null
  return item as BankAccount
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
    return 'Você não tem permissão para criar conta nesta empresa.'
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
  if (normalized.includes('informe o nome')) {
    return 'Informe o nome da conta.'
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

  return sortBankAccounts((data ?? []) as BankAccount[])
}

export async function createBankAccount(input: {
  companyId: string
  name: string
  bankName?: string
}): Promise<BankAccount> {
  const name = input.name.trim()
  if (!name) throw new Error('Informe o nome da conta.')

  const { data, error } = await supabase.rpc('create_company_bank_account', {
    p_company_id: input.companyId,
    p_name: name,
  })

  if (!error) {
    const created = asBankAccount(data)
    if (created) return created
  }

  if (error && !isMissingDbObject(error)) {
    console.error('Erro ao criar conta bancária via RPC:', error)
    throw new Error(mapActualError(error, 'Não foi possível criar a conta bancária.'))
  }

  if (error) {
    console.error('Erro ao criar conta bancária via RPC:', error)
  }

  const { data: currentRows, error: currentError } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('company_id', input.companyId)

  if (currentError) {
    console.error('Erro ao localizar conta bancária:', currentError)
    throw new Error(
      mapActualError(
        error ?? currentError,
        'Não foi possível criar a conta bancária.',
      ),
    )
  }

  const existing = ((currentRows ?? []) as BankAccount[]).find(
    (item) => item.name.trim().toLowerCase() === name.toLowerCase(),
  )
  if (existing) {
    if (existing.is_active) return existing
    const { data: reactivated, error: reactivateError } = await supabase
      .from('bank_accounts')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select('*')
      .maybeSingle()
    if (reactivateError) {
      throw new Error(
        mapActualError(reactivateError, 'Não foi possível reativar a conta bancária.'),
      )
    }
    return asBankAccount(reactivated) ?? { ...existing, is_active: true }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('bank_accounts')
    .insert({
      company_id: input.companyId,
      name,
      bank_name: input.bankName?.trim() || name,
    })
    .select('*')
    .maybeSingle()

  const created = asBankAccount(inserted)
  if (created) return created

  console.error('Erro ao criar conta bancária:', insertError)
  throw new Error(
    mapActualError(
      insertError ?? error,
      'Não foi possível criar a conta bancária.',
    ),
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
  if (filters.type) query = query.eq('type', filters.type)
  if (filters.departmentId) query = query.eq('department_id', filters.departmentId)
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
  }))
}

export async function classifyActualTransactions(input: {
  companyId: string
  transactionIds: string[]
  departmentId?: string | null
  categoryId?: string | null
  costCenterId?: string | null
  status?: ActualTransactionStatus
}): Promise<number> {
  if (input.transactionIds.length === 0) return 0

  const { data, error } = await supabase.rpc('classify_actual_transactions', {
    p_company_id: input.companyId,
    p_transaction_ids: input.transactionIds,
    p_department_id: input.departmentId || null,
    p_category_id: input.categoryId || null,
    p_cost_center_id: input.costCenterId || null,
    p_status: input.status ?? 'classified',
  })

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
  const withSuggestion = input.transactions.filter(
    (item) =>
      item.suggested_category_id ||
      item.suggested_department_id ||
      item.suggested_cost_center_id,
  )
  if (withSuggestion.length === 0) return 0

  let updated = 0
  for (const item of withSuggestion) {
    updated += await classifyActualTransactions({
      companyId: input.companyId,
      transactionIds: [item.id],
      departmentId: item.suggested_department_id,
      categoryId: item.suggested_category_id,
      costCenterId: item.suggested_cost_center_id,
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

  const { data, error } = await supabase.functions.invoke('process-statement', {
    body: { importId: importRow.id, companyId: input.companyId },
  })

  if (error) {
    console.error('Erro na função de processamento:', error)
    await supabase
      .from('statement_imports')
      .update({
        status: 'failed',
        error_message:
          'Não foi possível processar o extrato. Verifique se a função process-statement está implantada.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', importRow.id)
    throw new Error(
      'O arquivo foi enviado, mas o processamento falhou. Tente novamente em instantes.',
    )
  }

  const processed = data as ProcessStatementResult | null
  if (processed?.error) {
    throw new Error(processed.error)
  }

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
