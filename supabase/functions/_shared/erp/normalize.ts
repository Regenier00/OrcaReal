import {
  MAX_DESCRIPTION_CHARS,
  MAX_ERP_ENTRIES,
  MAX_WARNINGS,
} from './limits.ts'
import type {
  ErpEntrySide,
  ErpMoneyGroup,
  ErpMovementType,
  ErpParseResult,
  NormalizedErpEntry,
  ParseWarning,
} from './types.ts'

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

export function normalizeToken(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
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

export function excelSerialToIso(serial: number) {
  if (!Number.isFinite(serial) || serial < 20000 || serial > 80000) return null
  const epoch = Date.UTC(1899, 11, 30)
  return new Date(epoch + Math.floor(serial + 1e-9) * 86400000)
    .toISOString()
    .slice(0, 10)
}

export function parseBrazilianDate(value: string, defaultYear?: number) {
  const text = value.trim()
  if (!text) return null

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
  if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))

  const br = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/.exec(text)
  if (br) {
    const day = Number(br[1])
    const month = Number(br[2])
    let year = Number(br[3])
    if (year < 100) year += year >= 70 ? 1900 : 2000
    return isoDate(year, month, day)
  }

  const serial = Number(text.replace(',', '.'))
  if (Number.isFinite(serial) && text.length <= 6) {
    return excelSerialToIso(serial)
  }

  if (defaultYear && /^(\d{1,2})[\/\-.](\d{1,2})$/.exec(text)) {
    const partial = /^(\d{1,2})[\/\-.](\d{1,2})$/.exec(text)!
    return isoDate(defaultYear, Number(partial[2]), Number(partial[1]))
  }

  return null
}

export function parseAmount(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return roundMoney(Math.abs(value))
  }
  let text = String(value ?? '').trim()
  if (!text || text === '-' || text === '—') return null
  text = text.replace(/[R$\s]/gi, '')
  const negative = /^\(.*\)$/.test(text) || text.startsWith('-')
  text = text.replace(/^\(|\)$/g, '').replace(/^-/, '')
  if (!text) return null

  if (text.includes(',') && text.includes('.')) {
    if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
      text = text.replace(/\./g, '').replace(',', '.')
    } else {
      text = text.replace(/,/g, '')
    }
  } else if (text.includes(',')) {
    text = text.replace(/\./g, '').replace(',', '.')
  }

  const amount = Number(text)
  if (!Number.isFinite(amount)) return null
  const abs = roundMoney(Math.abs(amount))
  return negative ? abs : abs
}

export function signedAmount(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return roundMoney(value)
  }
  let text = String(value ?? '').trim()
  if (!text) return null
  const negative = /^\(.*\)$/.test(text) || /^-/.test(text.replace(/[R$\s]/gi, ''))
  const amount = parseAmount(text)
  if (amount == null) return null
  return negative ? -amount : amount
}

export function sideFromDebitCredit(
  debit: number | null,
  credit: number | null,
): { side: ErpEntrySide; amount: number } | null {
  const hasDebit = debit != null && debit > 0
  const hasCredit = credit != null && credit > 0
  if (hasDebit && !hasCredit) return { side: 'debit', amount: debit! }
  if (hasCredit && !hasDebit) return { side: 'credit', amount: credit! }
  if (hasDebit && hasCredit) {
    if (debit! >= credit!) return { side: 'debit', amount: debit! }
    return { side: 'credit', amount: credit! }
  }
  return null
}

export function typeFromSide(side: ErpEntrySide): ErpMovementType {
  if (side === 'credit') return 'income'
  if (side === 'debit') return 'expense'
  return 'unknown'
}

export function typeFromSigned(amount: number): {
  side: ErpEntrySide
  type: ErpMovementType
  amount: number
} {
  if (amount > 0) {
    return { side: 'credit', type: 'income', amount: roundMoney(amount) }
  }
  if (amount < 0) {
    return { side: 'debit', type: 'expense', amount: roundMoney(Math.abs(amount)) }
  }
  return { side: 'unknown', type: 'unknown', amount: 0 }
}

/** Heurística leve — só sugere; a classificação definitiva usa regras da empresa. */
export function heuristicMoneyGroup(input: {
  accountCode?: string | null
  accountName?: string | null
  costCenterName?: string | null
  description?: string | null
}): { moneyGroup: ErpMoneyGroup; destinationName: string } | null {
  const blob = normalizeToken(
    [
      input.accountCode,
      input.accountName,
      input.costCenterName,
      input.description,
    ]
      .filter(Boolean)
      .join(' '),
  )
  if (!blob) return null

  const destination =
    (input.costCenterName && input.costCenterName.trim()) ||
    (input.accountName && input.accountName.trim()) ||
    null

  if (
    /\b(receita|faturamento|venda|vendas|servico prestado|recebimento)\b/.test(blob) ||
    /^3[\.\d]/.test(String(input.accountCode ?? '').trim())
  ) {
    return {
      moneyGroup: 'revenue',
      destinationName: destination || 'Receitas operacionais',
    }
  }
  if (
    /\b(cmv|cpv|csv|custo da mercadoria|custo do produto|custo do servico|custo direto)\b/.test(
      blob,
    )
  ) {
    return {
      moneyGroup: 'cost',
      destinationName: destination || 'Custos operacionais',
    }
  }
  if (
    /\b(investimento|imobilizado|capex|ativo imobilizado|maquina|equipamento)\b/.test(
      blob,
    )
  ) {
    return {
      moneyGroup: 'investment',
      destinationName: destination || 'Investimentos',
    }
  }
  if (
    /\b(despesa|salario|aluguel|energia|agua|telefone|marketing|administrativ|financeira|imposto|taxa)\b/.test(
      blob,
    ) ||
    /^4[\.\d]/.test(String(input.accountCode ?? '').trim())
  ) {
    return {
      moneyGroup: 'expense',
      destinationName: destination || 'Despesas operacionais',
    }
  }
  if (destination) {
    return null
  }
  return null
}

export function emptyResult(
  format: ErpParseResult['format'],
  warnings: ParseWarning[] = [],
): ErpParseResult {
  return {
    format,
    layout: null,
    entries: [],
    warnings: capWarnings(warnings),
  }
}

export function finalizeEntries(
  entries: NormalizedErpEntry[],
  warnings: ParseWarning[],
  format: ErpParseResult['format'],
  layout: ErpParseResult['layout'],
): ErpParseResult {
  if (entries.length > MAX_ERP_ENTRIES) {
    return {
      format,
      layout,
      entries: entries.slice(0, MAX_ERP_ENTRIES),
      warnings: capWarnings([
        ...warnings,
        {
          message: `Limite de ${MAX_ERP_ENTRIES} lançamentos atingido. O restante foi ignorado.`,
        },
      ]),
    }
  }
  return {
    format,
    layout,
    entries,
    warnings: capWarnings(warnings),
  }
}

export function cellText(value: unknown) {
  if (value == null) return ''
  return String(value)
}
