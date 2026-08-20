/** Limites do importador de centros de custo (somente XLSX). */
export const MAX_COST_CENTER_FILE_BYTES = 5 * 1024 * 1024
export const MAX_COST_CENTER_ROWS = 5_000
export const MAX_COST_CENTER_NAME = 200
export const MAX_COST_CENTER_CODE = 80
export const MAX_COST_CENTER_DESCRIPTION = 500
export const MAX_WARNINGS = 40

export const XLSX_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
  'application/zip',
])
