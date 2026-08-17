import type { DetectedFile, StatementFormat } from './types.ts'

function startsWith(bytes: Uint8Array, ascii: string) {
  if (bytes.length < ascii.length) return false
  for (let i = 0; i < ascii.length; i += 1) {
    if (bytes[i] !== ascii.charCodeAt(i)) return false
  }
  return true
}

function decodeText(bytes: Uint8Array) {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  if (!utf8.includes('\uFFFD')) return utf8
  return new TextDecoder('latin1').decode(bytes)
}

export function identifyStatement(
  fileName: string,
  bytes: Uint8Array,
): DetectedFile {
  const name = fileName.toLowerCase()
  const sample = decodeText(bytes.slice(0, Math.min(bytes.length, 256_000)))
  const head = sample.slice(0, 4000).toUpperCase()

  let format: StatementFormat = 'unknown'

  if (startsWith(bytes, '%PDF') || name.endsWith('.pdf')) {
    format = 'pdf'
  } else if (startsWith(bytes, 'PK') || name.endsWith('.xlsx')) {
    format = 'xlsx'
  } else if (
    head.includes('OFXHEADER') ||
    head.includes('<OFX') ||
    name.endsWith('.ofx') ||
    name.endsWith('.qfx')
  ) {
    format = 'ofx'
  } else if (
    name.endsWith('.csv') ||
    name.endsWith('.txt') ||
    /[;\t,]/.test(sample.slice(0, 1000))
  ) {
    format = 'csv'
  }

  const text = format === 'xlsx' || format === 'pdf' ? sample : decodeText(bytes)
  return { fileName, bytes, text, format }
}
