import type {
  ActualTransactionStatus,
  ActualTransactionType,
  StatementFileType,
  StatementImportStatus,
} from '@/types/database'

export const STATEMENT_FILE_TYPES: StatementFileType[] = [
  'ofx',
  'csv',
  'xlsx',
  'pdf',
  'unknown',
]

export const ACCEPTED_STATEMENT_EXTENSIONS = [
  '.ofx',
  '.qfx',
  '.csv',
  '.txt',
  '.xlsx',
  '.pdf',
] as const

export const ACCEPTED_STATEMENT_ACCEPT = ACCEPTED_STATEMENT_EXTENSIONS.join(',')
export const MAX_STATEMENT_FILE_BYTES = 20 * 1024 * 1024

export const FILE_TYPE_LABEL: Record<StatementFileType, string> = {
  ofx: 'OFX',
  csv: 'CSV',
  xlsx: 'XLSX',
  pdf: 'PDF',
  unknown: 'Desconhecido',
}

export const IMPORT_STATUS_LABEL: Record<StatementImportStatus, string> = {
  uploaded: 'Enviado',
  identifying: 'Identificando',
  parsing: 'Lendo lançamentos',
  normalizing: 'Normalizando',
  completed: 'Concluído',
  failed: 'Falhou',
  ocr_required: 'OCR necessário',
}

export const TRANSACTION_TYPE_LABEL: Record<ActualTransactionType, string> = {
  income: 'Entrada',
  expense: 'Saída',
  transfer: 'Transferência',
  unknown: 'Não identificado',
}

export const TRANSACTION_STATUS_LABEL: Record<ActualTransactionStatus, string> = {
  pending: 'Não apropriado',
  classified: 'Apropriado',
  ignored: 'Ignorado',
}

export const ACTUAL_PATHS = {
  root: '/app/realizado',
  import: '/app/realizado/importar',
  unappropriated: '/app/realizado/nao-apropriados',
} as const

export const IMPORT_STEPS: Array<{
  status: StatementImportStatus
  label: string
}> = [
  { status: 'uploaded', label: 'Upload' },
  { status: 'identifying', label: 'Identificação' },
  { status: 'parsing', label: 'Parser' },
  { status: 'normalizing', label: 'Normalização' },
  { status: 'completed', label: 'Banco' },
]

export function fileTypeFromName(fileName: string): StatementFileType {
  const name = fileName.toLowerCase()
  if (name.endsWith('.ofx') || name.endsWith('.qfx')) return 'ofx'
  if (name.endsWith('.csv') || name.endsWith('.txt')) return 'csv'
  if (name.endsWith('.xlsx')) return 'xlsx'
  if (name.endsWith('.pdf')) return 'pdf'
  return 'unknown'
}

export function isAcceptedStatementFile(fileName: string) {
  return fileTypeFromName(fileName) !== 'unknown'
}

export function importStepIndex(status: StatementImportStatus) {
  if (status === 'failed' || status === 'ocr_required') return 4
  const index = IMPORT_STEPS.findIndex((step) => step.status === status)
  return index < 0 ? 0 : index
}

export function hasSuggestion(item: {
  suggested_category_id: string | null
  suggested_department_id: string | null
  suggested_cost_center_id: string | null
}) {
  return Boolean(
    item.suggested_category_id ||
      item.suggested_department_id ||
      item.suggested_cost_center_id,
  )
}
