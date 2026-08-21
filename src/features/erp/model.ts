import type {
  ErpFileType,
  ErpImportStatus,
  MoneyGroup,
} from '@/types/database'

export const ERP_FILE_TYPES: ErpFileType[] = [
  'xlsx',
  'csv',
  'ofx',
  'pdf',
  'unknown',
]

export const ACCEPTED_ERP_EXTENSIONS = ['.xlsx', '.csv', '.txt'] as const

export const ACCEPTED_ERP_ACCEPT = ACCEPTED_ERP_EXTENSIONS.join(',')
export const MAX_ERP_FILE_BYTES = 20 * 1024 * 1024

export const ERP_FILE_TYPE_LABEL: Record<ErpFileType, string> = {
  xlsx: 'XLSX',
  csv: 'CSV',
  ofx: 'OFX',
  pdf: 'PDF',
  unknown: 'Desconhecido',
}

export const ERP_IMPORT_STATUS_LABEL: Record<ErpImportStatus, string> = {
  uploaded: 'Enviado',
  validating: 'Validando',
  identifying: 'Identificando layout',
  parsing: 'Lendo lançamentos',
  normalizing: 'Normalizando',
  classifying: 'Classificando',
  completed: 'Concluído',
  failed: 'Falhou',
}

export const ERP_MONEY_GROUP_LABEL: Record<MoneyGroup, string> = {
  revenue: 'Receita',
  cost: 'Custo',
  expense: 'Despesa',
  investment: 'Investimento',
}

export const ERP_PATHS = {
  import: '/app/realizado/importar-erp',
  review: '/app/realizado/revisar-erp',
} as const

export const ERP_IMPORT_STEPS: Array<{
  status: ErpImportStatus
  label: string
}> = [
  { status: 'uploaded', label: 'Upload' },
  { status: 'validating', label: 'Validação' },
  { status: 'identifying', label: 'Layout' },
  { status: 'parsing', label: 'Parser' },
  { status: 'normalizing', label: 'Normalização' },
  { status: 'classifying', label: 'Classificação' },
  { status: 'completed', label: 'Concluído' },
]

export function erpFileTypeFromName(fileName: string): ErpFileType {
  const name = fileName.toLowerCase()
  if (name.endsWith('.xlsx')) return 'xlsx'
  if (name.endsWith('.csv') || name.endsWith('.txt')) return 'csv'
  if (name.endsWith('.ofx') || name.endsWith('.qfx')) return 'ofx'
  if (name.endsWith('.pdf')) return 'pdf'
  return 'unknown'
}

export function isAcceptedErpFile(fileName: string) {
  const type = erpFileTypeFromName(fileName)
  return type === 'xlsx' || type === 'csv'
}

export function erpImportStepIndex(status: ErpImportStatus) {
  if (status === 'failed') return 5
  const index = ERP_IMPORT_STEPS.findIndex((step) => step.status === status)
  return index < 0 ? 0 : index
}

export function completedErpMessage(input: {
  inserted: number
  duplicates?: number
  errors: number
  pending: number
}) {
  const parts = [
    `${input.inserted} lançamento${input.inserted === 1 ? '' : 's'} importado${input.inserted === 1 ? '' : 's'}`,
  ]
  if (input.errors > 0) {
    parts.push(`${input.errors} com erro`)
  }
  if (input.pending > 0) {
    parts.push(`${input.pending} pendente${input.pending === 1 ? '' : 's'} de revisão`)
  }
  return parts.join(' · ')
}
