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

export interface DateParseOptions {
  defaultYear?: number
}

export function inferStatementYear(text: string, fallback?: number) {
  const now = fallback ?? new Date().getUTCFullYear()
  const counts = new Map<number, number>()
  const yearRe = /\b((?:19|20)\d{2})\b/g
  let match: RegExpExecArray | null
  while ((match = yearRe.exec(text))) {
    const year = Number(match[1])
    if (year < 1990 || year > now + 1) continue
    counts.set(year, (counts.get(year) ?? 0) + 1)
  }
  let best = now
  let bestCount = 0
  for (const [year, count] of counts) {
    if (count > bestCount || (count === bestCount && year >= best)) {
      best = year
      bestCount = count
    }
  }
  return best
}

function resolveDayMonth(first: number, second: number) {
  let day = first
  let month = second
  if (month > 12 && day <= 12) {
    day = second
    month = first
  }
  return { day, month }
}

export function parseBrazilianDate(
  value: unknown,
  options?: DateParseOptions,
): string | null {
  let raw = String(value ?? '').trim()
  if (!raw) return null
  raw = raw
    .replace(/(\d{2}:\d{2}(?::\d{2})?)(\d)/g, '$1 $2')
    .replace(/\s*[-–—]\s*\d{1,2}:\d{2}(?::\d{2})?\s*/g, ' ')
    .trim()
  const leadingDate = raw.match(/^(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{1,2}[/-]\d{1,2})/)
  if (leadingDate) raw = leadingDate[1]

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))

  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})(?:\d{6})?$/)
  if (compact) {
    return isoDate(Number(compact[1]), Number(compact[2]), Number(compact[3]))
  }

  const parts = raw.match(
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/,
  )
  if (parts) {
    const { day, month } = resolveDayMonth(Number(parts[1]), Number(parts[2]))
    return isoDate(parseYearToken(parts[3]), month, day)
  }

  const yearless = raw.match(/^(\d{1,2})[/-](\d{1,2})$/)
  if (yearless) {
    const { day, month } = resolveDayMonth(Number(yearless[1]), Number(yearless[2]))
    const year = options?.defaultYear ?? new Date().getUTCFullYear()
    return isoDate(year, month, day)
  }

  const named = raw.match(
    /^(\d{1,2})[./\-\s]+([A-Za-zÀ-ÿ]{3,9})\.?[./\-\s]+(\d{2,4})$/,
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
  let raw = String(value ?? '')
    .trim()
    .replace(/[rR]\$\s?/g, '')
    .replace(/(\d{1,3})\s+(\d{3},\d{2})\b/g, '$1.$2')
    .replace(/\s/g, '')
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


export function extractStatementBalances(text: string): {
  start: number | null
  end: number | null
} {
  const sample = text.slice(0, 12_000)
  const pick = (pattern: RegExp) => {
    const match = sample.match(pattern)
    if (!match?.[1]) return null
    const amount = parseAmount(match[1])
    return amount == null ? null : Math.abs(amount)
  }
  return {
    start: pick(
      /saldo\s*(?:anterior|inicial)\D{0,24}?((?:R\$\s*)?\d[\d.\s,]*)/i,
    ),
    end: pick(
      /saldo\s*(?:final|atual|do\s+dia)\D{0,24}?((?:R\$\s*)?\d[\d.\s,]*)/i,
    ),
  }
}

function descriptionQuality(description: string) {
  const norm = description.trim()
  if (!norm) return -50
  if (/^\d+$/.test(norm)) return -30
  if (!/[a-zA-ZÀ-ÿ]/.test(norm)) return -10
  if (/^(credito|debito|cr[eé]dito|d[eé]bito)$/i.test(norm)) return -25
  return 10 + Math.min(norm.length, 40)
}

/** Prefer parses whose descriptions, types and running balance look coherent. */
export function scoreParsedMovements(
  movements: RawMovement[],
  sampleText?: string,
): number {
  if (movements.length === 0) return -1

  let score = movements.length * 100
  for (const movement of movements) {
    let quality = descriptionQuality(movement.description)
    if (
      /^\d+$/.test(movement.description.trim()) &&
      movement.counterparty &&
      /[a-zA-ZÀ-ÿ]/.test(movement.counterparty)
    ) {
      quality -= 15
    }
    score += quality
    if (movement.type !== 'unknown') score += 5
    if (movement.balance != null && movement.balance > 0) score += 8
    if (/^\d{4,}\s/.test(movement.description.trim())) score -= 20
    if (
      movement.balance != null &&
      Math.abs(movement.balance - movement.amount) < 0.01
    ) {
      score -= 40
    }
  }

  if (sampleText) {
    const { start, end } = extractStatementBalances(sampleText)
    if (start != null && end != null) {
      let income = 0
      let expense = 0
      for (const movement of movements) {
        if (movement.type === 'income') income += movement.amount
        else if (movement.type === 'expense') expense += movement.amount
      }
      const expected = roundMoney(start + income - expense)
      const diff = Math.abs(expected - end)
      if (diff <= 0.02) score += 500
      else score -= Math.min(400, Math.round(diff))
    }
  }

  return score
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
