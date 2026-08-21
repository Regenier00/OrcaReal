import {
  CSV_MIME_TYPES,
  MAX_LEDGER_ACCOUNT_FILE_BYTES,
  XLSX_MIME_TYPES,
} from './limits.ts'

function isXlsxMagic(bytes: Uint8Array) {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  )
}

function hasXlsxExtension(fileName: string) {
  return fileName.trim().toLowerCase().endsWith('.xlsx')
}

function hasCsvExtension(fileName: string) {
  const lower = fileName.trim().toLowerCase()
  return lower.endsWith('.csv') || lower.endsWith('.txt')
}

/**
 * Valida tipo e tamanho. Regras de negócio (dedupe/upsert) ficam na RPC.
 */
export function assertSafeLedgerAccountFile(input: {
  fileName: string
  mimeType?: string | null
  bytes: Uint8Array
}): 'xlsx' | 'csv' {
  const name = String(input.fileName ?? '').trim()
  if (!name) {
    throw new Error('Informe o nome do arquivo.')
  }
  if (input.bytes.byteLength === 0) {
    throw new Error('O arquivo enviado está vazio.')
  }
  if (input.bytes.byteLength > MAX_LEDGER_ACCOUNT_FILE_BYTES) {
    throw new Error('O arquivo excede o limite de 5 MB.')
  }

  const mime = String(input.mimeType ?? '')
    .trim()
    .toLowerCase()

  if (hasXlsxExtension(name)) {
    if (mime && !XLSX_MIME_TYPES.has(mime)) {
      throw new Error('Tipo de arquivo não permitido. Use XLSX ou CSV.')
    }
    if (!isXlsxMagic(input.bytes)) {
      throw new Error('O conteúdo do arquivo não é um XLSX válido.')
    }
    return 'xlsx'
  }

  if (hasCsvExtension(name)) {
    if (mime && !CSV_MIME_TYPES.has(mime)) {
      throw new Error('Tipo de arquivo não permitido. Use XLSX ou CSV.')
    }
    return 'csv'
  }

  throw new Error('Envie um arquivo XLSX (.xlsx) ou CSV (.csv) com 2 colunas.')
}
