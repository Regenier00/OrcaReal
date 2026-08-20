import {
  MAX_ERP_FILE_BYTES,
  MAX_TEXT_SAMPLE,
} from './limits.ts'
import type { ErpFileFormat } from './types.ts'

/** MIME → formatos permitidos. Nunca confiar só na extensão. */
const ALLOWED_MIME: Record<string, ErpFileFormat[]> = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'text/csv': ['csv'],
  'text/plain': ['csv'],
  'application/csv': ['csv'],
  'application/octet-stream': ['xlsx', 'csv'],
}

function startsWith(bytes: Uint8Array, ascii: string) {
  if (bytes.length < ascii.length) return false
  for (let i = 0; i < ascii.length; i += 1) {
    if (bytes[i] !== ascii.charCodeAt(i)) return false
  }
  return true
}

function hasMagic(bytes: Uint8Array, magic: number[]) {
  if (bytes.length < magic.length) return false
  return magic.every((value, index) => bytes[index] === value)
}

export function isExecutable(bytes: Uint8Array) {
  return (
    hasMagic(bytes, [0x4d, 0x5a]) ||
    hasMagic(bytes, [0x7f, 0x45, 0x4c, 0x46]) ||
    hasMagic(bytes, [0xca, 0xfe, 0xba, 0xbe]) ||
    hasMagic(bytes, [0xcf, 0xfa, 0xed, 0xfe]) ||
    hasMagic(bytes, [0xce, 0xfa, 0xed, 0xfe])
  )
}

export function looksBinary(bytes: Uint8Array) {
  const sample = bytes.subarray(0, Math.min(bytes.length, 2048))
  let nuls = 0
  for (const value of sample) {
    if (value === 0) nuls += 1
  }
  return nuls > sample.length * 0.02
}

export function decodeText(bytes: Uint8Array) {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  if (!utf8.includes('\uFFFD')) return utf8
  return new TextDecoder('latin1').decode(bytes)
}

export function sniffErpFormat(
  fileName: string,
  bytes: Uint8Array,
): ErpFileFormat {
  const name = String(fileName ?? '').toLowerCase()
  const sample = decodeText(bytes.subarray(0, Math.min(bytes.length, MAX_TEXT_SAMPLE)))

  // Conteúdo manda — extensão é só fallback.
  if (startsWith(bytes, '%PDF')) return 'pdf'
  if (startsWith(bytes, 'PK')) return 'xlsx'
  const head = sample.slice(0, 4000).toUpperCase()
  if (head.includes('OFXHEADER') || head.includes('<OFX')) return 'ofx'
  if (
    name.endsWith('.csv') ||
    name.endsWith('.txt') ||
    /[;\t,]/.test(sample.slice(0, 1000))
  ) {
    return 'csv'
  }
  if (name.endsWith('.xlsx')) return 'xlsx'
  if (name.endsWith('.pdf')) return 'pdf'
  if (name.endsWith('.ofx') || name.endsWith('.qfx')) return 'ofx'
  return 'unknown'
}

/**
 * Validação rigorosa antes de qualquer parse.
 * Primário: XLSX/CSV. OFX/PDF rejeitados até parsers estarem prontos.
 */
export function assertSafeErpFile(
  fileName: string,
  bytes: Uint8Array,
  mimeType?: string | null,
) {
  if (bytes.byteLength === 0) {
    throw new Error('O arquivo enviado está vazio.')
  }
  if (bytes.byteLength > MAX_ERP_FILE_BYTES) {
    throw new Error('O arquivo excede o limite de 20 MB.')
  }
  if (isExecutable(bytes)) {
    throw new Error('Este arquivo não é um export válido de ERP.')
  }

  const format = sniffErpFormat(fileName, bytes)
  if (format === 'unknown') {
    throw new Error(
      'Formato não reconhecido. Envie um arquivo XLSX ou CSV.',
    )
  }
  if (format === 'ofx' || format === 'pdf') {
    throw new Error(
      'OFX e PDF ainda não estão disponíveis neste importador. Use XLSX ou CSV.',
    )
  }

  const declared = String(mimeType ?? '').toLowerCase().split(';')[0]?.trim()
  if (declared && declared !== 'application/octet-stream') {
    const allowed = ALLOWED_MIME[declared]
    if (!allowed) {
      throw new Error('Tipo MIME não permitido para importação de ERP.')
    }
    if (!allowed.includes(format)) {
      throw new Error(
        'O tipo MIME informado não corresponde ao conteúdo do arquivo.',
      )
    }
  }

  if (format === 'xlsx' && !startsWith(bytes, 'PK')) {
    throw new Error('O conteúdo não corresponde a uma planilha XLSX.')
  }
  if (format === 'csv' && looksBinary(bytes)) {
    throw new Error(
      'O arquivo contém dados binários e não pode ser lido como CSV.',
    )
  }
}

export function extensionFromName(fileName: string): ErpFileFormat {
  const name = fileName.toLowerCase()
  if (name.endsWith('.xlsx')) return 'xlsx'
  if (name.endsWith('.csv') || name.endsWith('.txt')) return 'csv'
  if (name.endsWith('.ofx') || name.endsWith('.qfx')) return 'ofx'
  if (name.endsWith('.pdf')) return 'pdf'
  return 'unknown'
}

/** MIME seguro derivado do conteúdo (não do browser). */
export function sniffedMimeType(format: ErpFileFormat): string {
  if (format === 'xlsx') {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }
  if (format === 'csv') return 'text/csv'
  return 'application/octet-stream'
}
