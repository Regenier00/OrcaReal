import { MAX_DESCRIPTION_CHARS, MAX_TRANSACTIONS, MAX_WARNINGS } from './limits.ts'
import type { MovementType, ParseResult, ParseWarning, RawMovement } from './types.ts'

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

export function normalizeDescription(value: string) {
  let text = value.replace(/\s+/g, ' ').trim()
  text = text.replace(/^[=+\-@|]+/, '').trim()
  if (text.length > MAX_DESCRIPTION_CHARS) {
    text = text.slice(0, MAX_DESCRIPTION_CHARS)
  }
  return text
}

export function capWarnings(warnings: ParseWarning[]) {
  if (warnings.length <= MAX_WARNINGS) return warnings
  return [
    ...warnings.slice(0, MAX_WARNINGS),
    { message: `${warnings.length - MAX_WARNINGS} avisos adicionais foram omitidos.` },
  ]
}

function pad2(value: number | string) {
  return String(value).padStart(2, '0')
}

function isoDate(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return `${year}-${pad2(month)}-${pad2(day)}`
}

const MONTH_INDEX: Record<string, number> = {
  jan: 1,
  janeiro: 1,
  january: 1,
  fev: 2,
  fevereiro: 2,
  feb: 2,
  february: 2,
  mar: 3,
  marco: 3,
  march: 3,
  abr: 4,
  abril: 4,
  apr: 4,
  april: 4,
  mai: 5,
  maio: 5,
  may: 5,
  jun: 6,
  junho: 6,
  june: 6,
  jul: 7,
  julho: 7,
  july: 7,
  ago: 8,
  agosto: 8,
  aug: 8,
  august: 8,
  set: 9,
  setembro: 9,
  sep: 9,
  sept: 9,
  september: 9,
  out: 10,
  outubro: 10,
  oct: 10,
  october: 10,
  nov: 11,
  novembro: 11,
  november: 11,
  dez: 12,
  dezembro: 12,
  dec: 12,
  december: 12,
}

function parseYearToken(token: string) {
  if (token.length === 2) {
    return Number(token) >= 70 ? Number(`19${token}`) : Number(`20${token}`)
  }
  return Number(token)
}

export function excelSerialToIso(serial: number) {
  if (!Number.isFinite(serial) || serial < 20000 || serial > 80000) return null
  const epoch = Date.UTC(1899, 11, 30)
  return new Date(epoch + Math.floor(serial + 1e-9) * 86400000).toISOString().slice(0, 10)
}

export function parseBrazilianDate(value: unknown): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))

  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})(?:\d{6})?$/)
  if (compact) {
    return isoDate(Number(compact[1]), Number(compact[2]), Number(compact[3]))
  }

  const parts = raw.match(
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?)?$/,
  )
  if (parts) {
    let first = Number(parts[1])
    let second = Number(parts[2])
    const year = parseYearToken(parts[3])
    if (second > 12 && first <= 12) {
      const swapped = first
      first = second
      second = swapped
    }
    return isoDate(year, second, first)
  }

  const named = raw.match(
    /^(\d{1,2})[./\-\s]+([A-Za-zÀ-ÿ]{3,9})\.?[./\-\s]+(\d{2,4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/,
  )
  if (named) {
    const monthKey = named[2]
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    const month = MONTH_INDEX[monthKey]
    if (month) return isoDate(parseYearToken(named[3]), month, Number(named[1]))
  }

  const numeric = Number(raw.replace(',', '.'))
  if (Number.isFinite(numeric)) {
    return excelSerialToIso(numeric)
  }

  return null
}

export function parseAmount(value: unknown): number | null {
  let raw = String(value ?? '').trim().replace(/[rR]\$\s?/g, '').replace(/\s/g, '')
  if (!raw) return null

  const negative =
    raw.startsWith('-') ||
    raw.endsWith('-') ||
    /^\(.*\)$/.test(raw) ||
    /[dD]$/.test(raw)

  raw = raw.replace(/[()]/g, '').replace(/^[+-]/, '').replace(/[+-]$/, '')
  raw = raw.replace(/[dDcC]$/i, '')

  if (!raw) return null

  let normalized: string
  if (raw.includes(',') && raw.includes('.')) {
    if (raw.lastIndexOf(',') > raw.lastIndexOf('.')) {
      normalized = raw.replace(/\./g, '').replace(',', '.')
    } else {
      normalized = raw.replace(/,/g, '')
    }
  } else if (raw.includes(',')) {
    normalized = raw.replace(/\./g, '').replace(',', '.')
  } else {
    normalized = raw
  }

  const amount = Number(normalized)
  if (!Number.isFinite(amount)) return null
  return roundMoney(negative ? -Math.abs(amount) : amount)
}

export function typeFromSignedAmount(amount: number): MovementType {
  if (amount > 0) return 'income'
  if (amount < 0) return 'expense'
  return 'unknown'
}

export function typeFromLabel(value: unknown): MovementType | null {
  const key = String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
  if (!key) return null
  if (
    /^(credito|credit|c|cr|entrada|receita|recebido|deposito)$/.test(key) ||
    key.includes('credito') ||
    key.includes('entrada')
  ) {
    return 'income'
  }
  if (
    /^(debito|debit|d|db|saida|despesa|tarifa|pagamento|compra)$/.test(key) ||
    key.includes('debito') ||
    key.includes('tarifa') ||
    key.includes('saida')
  ) {
    return 'expense'
  }
  return null
}

export function typeFromCreditDebit(
  credit: number | null,
  debit: number | null,
): { amount: number; type: MovementType } | null {
  const hasCredit = credit != null && credit !== 0
  const hasDebit = debit != null && debit !== 0
  if (hasCredit && !hasDebit) {
    return {
      amount: Math.abs(credit),
      type: 'income',
    }
  }
  if (hasDebit && !hasCredit) {
    return {
      amount: Math.abs(debit),
      type: 'expense',
    }
  }
  return null
}

export function emptyResult(format: ParseResult['format']): ParseResult {
  return {
    format,
    bankName: null,
    bankCode: null,
    accountHint: null,
    currency: 'BRL',
    movements: [],
    warnings: [],
    ocrRequired: false,
  }
}

export function finalizeMovements(movements: RawMovement[]): RawMovement[] {
  return movements
    .slice(0, MAX_TRANSACTIONS)
    .map((item) => ({
      ...item,
      description: normalizeDescription(item.description),
      amount: roundMoney(Math.abs(item.amount)),
      postedAt: item.postedAt,
    }))
    .filter(
      (item) =>
        Boolean(item.postedAt) &&
        Boolean(item.description) &&
        Number.isFinite(item.amount),
    )
    .sort((a, b) => a.postedAt.localeCompare(b.postedAt))
}
