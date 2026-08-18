import {
  MAX_STATEMENT_BYTES,
  MAX_TEXT_SAMPLE,
} from './limits.ts'
import type { StatementFormat } from './types.ts'

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

export function sniffFormat(
  fileName: string,
  bytes: Uint8Array,
): StatementFormat {
  const name = String(fileName ?? '').toLowerCase()
  const sample = decodeText(bytes.subarray(0, Math.min(bytes.length, MAX_TEXT_SAMPLE)))
  const head = sample.slice(0, 4000).toUpperCase()

  if (startsWith(bytes, '%PDF')) return 'pdf'
  if (startsWith(bytes, 'PK')) return 'xlsx'
  if (head.includes('OFXHEADER') || head.includes('<OFX')) return 'ofx'
  if (
    name.endsWith('.csv') ||
    name.endsWith('.txt') ||
    /[;\t,]/.test(sample.slice(0, 1000))
  ) {
    return 'csv'
  }
  if (name.endsWith('.ofx') || name.endsWith('.qfx')) return 'ofx'
  if (name.endsWith('.xlsx')) return 'xlsx'
  if (name.endsWith('.pdf')) return 'pdf'
  return 'unknown'
}

export function assertSafeStatementFile(fileName: string, bytes: Uint8Array) {
  if (bytes.byteLength === 0) {
    throw new Error('O arquivo enviado está vazio.')
  }
  if (bytes.byteLength > MAX_STATEMENT_BYTES) {
    throw new Error('O arquivo excede o limite de 20 MB.')
  }
  if (isExecutable(bytes)) {
    throw new Error('Este arquivo não é um extrato válido.')
  }

  const format = sniffFormat(fileName, bytes)
  if (format === 'unknown') {
    throw new Error(
      'Formato não reconhecido. Envie um arquivo OFX, CSV, XLSX ou PDF estruturado.',
    )
  }
  if (format === 'pdf' && !startsWith(bytes, '%PDF')) {
    throw new Error('O conteúdo não corresponde a um PDF.')
  }
  if (format === 'xlsx' && !startsWith(bytes, 'PK')) {
    throw new Error('O conteúdo não corresponde a uma planilha XLSX.')
  }
  if ((format === 'csv' || format === 'ofx') && looksBinary(bytes)) {
    throw new Error('O arquivo contém dados binários e não pode ser lido como extrato.')
  }
}
