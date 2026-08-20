/** Limites alinhados ao extrato + endurecidos pós-auditoria (Odoo-like). */
export const MAX_ERP_FILE_BYTES = 20 * 1024 * 1024
export const MAX_ERP_ENTRIES = 30_000
export const MAX_ERP_BATCH = 2_000
export const MAX_CSV_ROWS = 35_000
export const MAX_CSV_LINE_CHARS = 4_000
export const MAX_DESCRIPTION_CHARS = 500
export const MAX_WARNINGS = 40
export const MAX_ZIP_ENTRIES = 80
export const MAX_UNCOMPRESSED_ENTRY = 8 * 1024 * 1024
export const MAX_UNCOMPRESSED_TOTAL = 16 * 1024 * 1024
export const MAX_TEXT_SAMPLE = 256_000
export const HEADER_SCAN_ROWS = 80
export const MIN_HEADER_SCORE = 70
/** Distância máxima para fuzzy match (0 = igual). Espelha Odoo FUZZY_MATCH_DISTANCE. */
export const FUZZY_MATCH_DISTANCE = 0.2
export const PREVIEW_ROWS = 10
