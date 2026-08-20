import {
  MAX_COST_CENTER_FILE_BYTES,
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

/**
 * Valida tipo e tamanho no servidor. Não deve ser espelhada no frontend.
 */
export function assertSafeCostCenterXlsx(input: {
  fileName: string
  mimeType?: string | null
  bytes: Uint8Array
}) {
  const name = String(input.fileName ?? '').trim()
  if (!name) {
    throw new Error('Informe o nome do arquivo.')
  }
  if (!hasXlsxExtension(name)) {
    throw new Error('Envie apenas arquivos XLSX (.xlsx).')
  }
  if (input.bytes.byteLength === 0) {
    throw new Error('O arquivo enviado está vazio.')
  }
  if (input.bytes.byteLength > MAX_COST_CENTER_FILE_BYTES) {
    throw new Error('O arquivo excede o limite de 5 MB.')
  }

  const mime = String(input.mimeType ?? '')
    .trim()
    .toLowerCase()
  if (mime && !XLSX_MIME_TYPES.has(mime)) {
    throw new Error('Tipo de arquivo não permitido. Use XLSX.')
  }

  if (!isXlsxMagic(input.bytes)) {
    throw new Error('O conteúdo do arquivo não é um XLSX válido.')
  }
}
