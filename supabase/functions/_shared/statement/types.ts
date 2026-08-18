export type StatementFormat = 'ofx' | 'csv' | 'xlsx' | 'pdf' | 'unknown'

export type MovementType = 'income' | 'expense' | 'unknown'

export interface RawMovement {
  postedAt: string
  description: string
  amount: number
  type: MovementType
  balance: number | null
  externalId: string | null
  documentNumber: string | null
  counterparty: string | null
  raw: Record<string, unknown>
}

export interface ParseWarning {
  message: string
  row?: number
}

export interface ParseResult {
  format: StatementFormat
  bankName: string | null
  bankCode: string | null
  accountHint: string | null
  currency: string
  movements: RawMovement[]
  warnings: ParseWarning[]
  ocrRequired: boolean
}

export interface DetectedFile {
  fileName: string
  bytes: Uint8Array
  text: string
  format: StatementFormat
}

export interface StatementParser {
  readonly id: StatementFormat | 'ocr'
  matches(file: DetectedFile): boolean
  parse(file: DetectedFile): ParseResult | Promise<ParseResult>
}
