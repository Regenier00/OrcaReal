export type ErpFileFormat = 'xlsx' | 'csv' | 'ofx' | 'pdf' | 'unknown'

export type ErpEntrySide = 'debit' | 'credit' | 'unknown'

export type ErpMovementType = 'income' | 'expense' | 'unknown'

export type ErpMoneyGroup = 'revenue' | 'cost' | 'expense' | 'investment'

/** Lançamento já normalizado para o padrão interno do OrcaReal. */
export interface NormalizedErpEntry {
  postedAt: string
  description: string
  amount: number
  entrySide: ErpEntrySide
  type: ErpMovementType
  accountCode: string | null
  accountName: string | null
  costCenterCode: string | null
  costCenterName: string | null
  departmentName: string | null
  documentNumber: string | null
  externalId: string | null
  suggestedMoneyGroup: ErpMoneyGroup | null
  suggestedDestinationName: string | null
  suggestionSource: 'heuristic' | null
  raw: Record<string, unknown>
}

export interface ParseWarning {
  message: string
  row?: number
}

export interface DetectedLayout {
  format: ErpFileFormat
  headerIndex: number
  columns: Record<string, number>
  sheetName?: string | null
  /** Cabeçalhos → papel detectado (Odoo-like mapping memory). */
  headerRoles?: Array<{ header: string; role: string }>
}

export interface ErpParseResult {
  format: ErpFileFormat
  layout: DetectedLayout | null
  entries: NormalizedErpEntry[]
  warnings: ParseWarning[]
}

export interface DetectedErpFile {
  fileName: string
  bytes: Uint8Array
  text: string
  format: ErpFileFormat
  mimeType: string | null
  /** Mapeamentos salvos da empresa (header → role). */
  savedHeaders?: Record<string, string>
}

/**
 * Contrato de parser por formato / ERP.
 * Parsers específicos (TOTVS, Sankhya, Omie) implementam esta interface
 * sem alterar normalização ou classificação.
 */
export interface ErpParser {
  readonly id: string
  matches(file: DetectedErpFile): boolean
  parse(file: DetectedErpFile): ErpParseResult | Promise<ErpParseResult>
}
