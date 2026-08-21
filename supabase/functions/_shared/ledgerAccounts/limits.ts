/** Limites do importador de plano de contas (XLSX/CSV). */
export const MAX_LEDGER_ACCOUNT_FILE_BYTES = 5 * 1024 * 1024
export const MAX_LEDGER_ACCOUNT_ROWS = 20_000
export const MAX_LEDGER_ACCOUNT_CODE = 80
export const MAX_LEDGER_ACCOUNT_NAME = 200
export const MAX_WARNINGS = 40

export const XLSX_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
  'application/zip',
])

export const CSV_MIME_TYPES = new Set([
  'text/csv',
  'text/plain',
  'application/csv',
  'application/vnd.ms-excel',
  'application/octet-stream',
])
