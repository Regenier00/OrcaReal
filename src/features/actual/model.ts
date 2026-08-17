import type {
  ActualTransactionStatus,
  ActualTransactionType,
  BudgetPeriodKind,
  BudgetStatus,
  StatementFileType,
  StatementImportStatus,
} from '@/types/database'
import type {
  DraftBudget,
  DraftBudgetItem,
  LoadedBudget,
  LoadedBudgetItem,
} from '@/features/budget/model'
import { emptyAmounts, remapAmounts } from '@/features/budget/model'
import type { BudgetMonth } from '@/features/budget/period'

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

export { DEFAULT_BANKS, isDefaultBankAccount } from '@/features/actual/defaultBanks'

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

export const EDITABLE_TRANSACTION_TYPES: ActualTransactionType[] = [
  'expense',
  'income',
  'transfer',
  'unknown',
]

export function classifiedAmountForComparison(
  type: ActualTransactionType,
  amount: number
) {
  if (type === 'expense') return amount
  if (type === 'income') return -amount
  return 0
}

export interface ClassifiedActualSlice {
  departmentId: string | null
  costCenterId: string
  departmentName: string
  costCenterName: string
  monthKey: string
  amount: number
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
  byBudget: '/app/realizado/por-orcamento',
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

export interface DraftActual extends DraftBudget {
  budgetId: string
}

export interface LoadedActual extends LoadedBudget {
  budgetId: string
  budgetName: string | null
}

export function toDraftActual(actual: LoadedActual): DraftActual {
  return {
    id: actual.id,
    budgetId: actual.budgetId,
    name: actual.name,
    fiscalYear: actual.fiscalYear,
    periodLabel: actual.periodLabel,
    periodKind: actual.periodKind as BudgetPeriodKind,
    startDate: actual.startDate,
    endDate: actual.endDate,
    businessUnitId: actual.businessUnitId,
    notes: actual.notes,
    status: actual.status as BudgetStatus,
    items: actual.items.map((item) => ({
      localId: item.localId,
      businessUnitId: item.businessUnitId,
      departmentId: item.departmentId,
      costCenterId: item.costCenterId,
      activityId: item.activityId,
      categoryId: item.categoryId,
      amounts: { ...item.amounts },
    })),
  }
}

export function draftFromBudget(
  budget: LoadedBudget,
  months: BudgetMonth[],
  name: string
): DraftActual {
  return {
    budgetId: budget.id,
    name,
    fiscalYear: budget.fiscalYear,
    periodLabel: budget.periodLabel,
    periodKind: budget.periodKind,
    startDate: budget.startDate,
    endDate: budget.endDate,
    businessUnitId: budget.businessUnitId,
    notes: '',
    status: 'draft',
    items: budget.items.map((item) => copyItemFromBudget(item, months)),
  }
}

function copyItemFromBudget(
  item: LoadedBudgetItem,
  months: BudgetMonth[]
): DraftBudgetItem {
  return {
    localId: crypto.randomUUID(),
    businessUnitId: item.businessUnitId,
    departmentId: item.departmentId,
    costCenterId: item.costCenterId,
    activityId: item.activityId,
    categoryId: item.categoryId,
    amounts: emptyAmounts(months),
  }
}

export function alignActualToBudget(
  draft: DraftActual,
  budget: LoadedBudget,
  months: BudgetMonth[]
): DraftActual {
  const existing = new Map(
    draft.items.map((item) => [
      [item.businessUnitId || '', item.departmentId, item.costCenterId].join('|'),
      item,
    ])
  )

  const items = budget.items.map((item) => {
    const key = [
      item.businessUnitId || '',
      item.departmentId,
      item.costCenterId,
    ].join('|')
    const current = existing.get(key)
    if (current) {
      return {
        ...current,
        amounts: remapAmounts(current.amounts, months),
      }
    }
    return copyItemFromBudget(item, months)
  })

  return {
    ...draft,
    budgetId: budget.id,
    fiscalYear: budget.fiscalYear,
    periodLabel: budget.periodLabel,
    periodKind: budget.periodKind,
    startDate: budget.startDate,
    endDate: budget.endDate,
    businessUnitId: budget.businessUnitId,
    items,
  }
}
