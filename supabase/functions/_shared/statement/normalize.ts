import type { MovementType, ParseResult, RawMovement } from './types.ts'

const TRANSFER_PATTERN =
  /\b(ted|doc|tef|transf(?:erencia)?|resgate|aplicacao|aplicação|entre contas)\b/i

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

export function normalizeDescription(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export function parseBrazilianDate(value: string): string | null {
  const raw = value.trim()
  if (!raw) return null

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})(?:\d{6})?$/)
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`

  const br = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (br) {
    const day = br[1].padStart(2, '0')
    const month = br[2].padStart(2, '0')
    let year = br[3]
    if (year.length === 2) year = Number(year) >= 70 ? `19${year}` : `20${year}`
    return `${year}-${month}-${day}`
  }

  return null
}

export function parseAmount(value: string): number | null {
  let raw = value.trim().replace(/[rR]\$\s?/g, '').replace(/\s/g, '')
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

export function typeFromSignedAmount(
  amount: number,
  description = '',
): MovementType {
  if (TRANSFER_PATTERN.test(description)) return 'transfer'
  if (amount > 0) return 'income'
  if (amount < 0) return 'expense'
  return 'unknown'
}

export function typeFromCreditDebit(
  credit: number | null,
  debit: number | null,
  description = '',
): { amount: number; type: MovementType } | null {
  const hasCredit = credit != null && credit !== 0
  const hasDebit = debit != null && debit !== 0
  if (hasCredit && !hasDebit) {
    return {
      amount: Math.abs(credit),
      type: TRANSFER_PATTERN.test(description) ? 'transfer' : 'income',
    }
  }
  if (hasDebit && !hasCredit) {
    return {
      amount: Math.abs(debit),
      type: TRANSFER_PATTERN.test(description) ? 'transfer' : 'expense',
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
