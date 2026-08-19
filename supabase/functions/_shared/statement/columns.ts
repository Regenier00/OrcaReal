import {
  excelSerialToIso,
  inferStatementYear,
  parseAmount,
  parseBrazilianDate,
  typeFromCreditDebit,
  typeFromLabel,
  typeFromSignedAmount,
} from './normalize.ts'
import type { MovementType, RawMovement } from './types.ts'

/** Identifies date, description and amount columns in arbitrary bank statement tables. */

export type ColumnRole =
  | 'date'
  | 'description'
  | 'amount'
  | 'debit'
  | 'credit'
  | 'balance'
  | 'document'
  | 'type'
  | 'id'
  | 'counterparty'

export interface ColumnMap {
  headerIndex: number
  date: number
  description: number
  amount: number
  debit: number
  credit: number
  balance: number
  document: number
  type: number
  id: number
  counterparty: number
}

export interface TabularLayoutOptions {
  preferredHeaderIndex?: number
}

const HEADER_SCAN_ROWS = 80
const MIN_HEADER_SCORE = 60

const ALIASES: Record<ColumnRole, string[]> = {
  date: [
    'data',
    'date',
    'dtposted',
    'datalancamento',
    'datamovimento',
    'datatransacao',
    'datapagamento',
    'datacompetencia',
    'datavalor',
    'dtmovimento',
    'dtlancamento',
    'posted',
    'postingdate',
    'transactiondate',
    'valuedate',
    'dt',
    'datamov',
    'datamovto',
  ],
  description: [
    'descricao',
    'historico',
    'historicodescricao',
    'descricaohistorico',
    'memo',
    'description',
    'detalhes',
    'detalhe',
    'lancamento',
    'complemento',
    'narrativa',
    'narration',
    'observacao',
    'transacao',
    'payee',
    'desc',
    'titulo',
    'movimentacao',
    'detalhamento',
    'historicocomplemento',
  ],
  amount: [
    'valor',
    'amount',
    'trnamt',
    'value',
    'quantia',
    'vlr',
    'valorlancamento',
    'valortransacao',
    'valormovimento',
    'valoroperacao',
    'valorrs',
    'valorr',
    'valorbruto',
    'valorliquido',
    'valorpago',
    'valormovimentacao',
  ],
  debit: [
    'debito',
    'debit',
    'saida',
    'withdraw',
    'withdrawal',
    'valordebito',
    'vlrdebito',
    'pagamentos',
  ],
  credit: [
    'credito',
    'credit',
    'entrada',
    'deposit',
    'valorcredito',
    'vlrcredito',
    'recebimentos',
  ],
  balance: [
    'saldo',
    'balance',
    'runningbalance',
    'saldoatual',
    'saldocontabil',
    'saldors',
    'valorsaldo',
  ],
  document: [
    'documento',
    'docto',
    'doc',
    'nrodoc',
    'numerodocumento',
    'nrdoc',
    'ndoc',
    'numero',
    'referencia',
    'ref',
    'autenticacao',
    'checknum',
    'idlancamento',
  ],
  type: [
    'tipo',
    'nature',
    'natureza',
    'dc',
    'cd',
    'tipolancamento',
    'tipomovimento',
    'creddeb',
  ],
  id: ['id', 'fitid', 'uuid', 'hash', 'chave', 'identificador'],
  counterparty: [
    'contraparte',
    'favorecido',
    'pagador',
    'recebedor',
    'beneficiario',
    'cliente',
  ],
}

const SKIP_DESCRIPTION = /^(saldoanterior|saldoinicial|saldofinal|saldoatual|saldododia|openingbalance|closingbalance|previousbalance|total|totais|subtotal|soma|transportado)$/

export function cellText(value: unknown) {
  if (value == null) return ''
  return String(value)
}

export function normalizeHeader(value: unknown) {
  return cellText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

function scoreAlias(header: string, alias: string) {
  if (!header || !alias) return 0
  if (header === alias) return 100
  if (alias.length <= 2) return 0
  if (header.startsWith(alias)) return alias.length >= 4 ? 85 : 70
  if (alias.length >= 4 && header.includes(alias)) return 75
  if (alias.length >= 4 && alias.includes(header) && header.length >= 4) return 60
  return 0
}

export function bestRoleForHeader(
  header: string,
): { role: ColumnRole; score: number } | null {
  const normalized = normalizeHeader(header)
  if (!normalized) return null
  let best: { role: ColumnRole; score: number; aliasLen: number } | null = null
  for (const role of Object.keys(ALIASES) as ColumnRole[]) {
    for (const alias of ALIASES[role]) {
      const score = scoreAlias(normalized, alias)
      if (score <= 0) continue
      if (
        !best ||
        score > best.score ||
        (score === best.score && alias.length > best.aliasLen)
      ) {
        best = { role, score, aliasLen: alias.length }
      }
    }
  }
  return best ? { role: best.role, score: best.score } : null
}

function emptyMap(headerIndex: number): ColumnMap {
  return {
    headerIndex,
    date: -1,
    description: -1,
    amount: -1,
    debit: -1,
    credit: -1,
    balance: -1,
    document: -1,
    type: -1,
    id: -1,
    counterparty: -1,
  }
}

function mapFromHeaders(headers: string[]) {
  const map = emptyMap(0)
  const taken = new Set<number>()
  const ranked: Array<{ role: ColumnRole; index: number; score: number }> = []

  headers.forEach((header, index) => {
    const match = bestRoleForHeader(header ?? '')
    if (!match) return
    ranked.push({ role: match.role, index, score: match.score })
  })

  ranked.sort((a, b) => b.score - a.score || a.index - b.index)
  for (const item of ranked) {
    if (taken.has(item.index)) continue
    if (map[item.role] >= 0) continue
    map[item.role] = item.index
    taken.add(item.index)
  }

  return map
}

function headerRowScore(row: string[]) {
  const map = mapFromHeaders(row)
  const roles = (Object.keys(map) as Array<keyof ColumnMap>).filter(
    (key) => key !== 'headerIndex' && map[key] >= 0,
  )
  if (roles.length === 0) return 0

  let score = 0
  for (let i = 0; i < row.length; i += 1) {
    const match = bestRoleForHeader(row[i] ?? '')
    if (match) score += match.score
  }
  if (map.date >= 0) score += 40
  if (map.description >= 0) score += 40
  if (map.amount >= 0 || (map.debit >= 0 && map.credit >= 0)) score += 40
  if (roles.length >= 3) score += 50

  const dataLike = row.filter((cell) => {
    const text = cell ?? ''
    const date = parseBrazilianDate(text)
    const amount = parseAmount(text)
    return Boolean(date) || (amount != null && /\d/.test(text) && !bestRoleForHeader(text))
  }).length
  if (dataLike >= 2 && roles.length < 2) score -= 100
  return score
}

function looksLikeExcelSerial(value: string) {
  const compact = value.trim()
  if (!/^-?\d+([.,]\d+)?$/.test(compact)) return false
  return Boolean(excelSerialToIso(Number(compact.replace(',', '.'))))
}

function looksLikeTextDate(value: string) {
  const raw = value.trim()
  if (!raw) return false
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return true
  if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(raw)) return true
  if (/^\d{1,2}[/-]\d{1,2}$/.test(raw)) return Boolean(parseBrazilianDate(raw))
  if (/^\d{1,2}[./\-\s]+[A-Za-zÀ-ÿ]{3,}/.test(raw)) {
    return Boolean(parseBrazilianDate(raw))
  }
  if (/^\d{8}(?:\d{6})?$/.test(raw)) {
    return Boolean(parseBrazilianDate(raw))
  }
  return looksLikeExcelSerial(raw)
}

function looksLikeAmount(value: string) {
  if (looksLikeTextDate(value) || looksLikeExcelSerial(value)) return false
  const amount = parseAmount(value)
  if (amount == null) return false
  const compact = value.trim().replace(/\s/g, '')
  if (/r\$/i.test(value)) return true
  if (/[.,]\d{1,2}$/.test(compact.replace(/[+-]$/, ''))) return true
  if (/^[+-]/.test(compact) || /[+-]$/.test(compact)) return true
  return /^-?\d+([.,]\d+)?$/.test(compact) && Math.abs(amount) < 1e9
}

function hasLetters(value: string) {
  return /[a-zA-ZÀ-ÿ]/.test(value)
}

interface ColStats {
  index: number
  filled: number
  textDates: number
  serialDates: number
  amounts: number
  signedAmounts: number
  decimalAmounts: number
  text: number
  avgTextLen: number
}

function columnStats(rows: string[][], start: number): ColStats[] {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
  const stats: ColStats[] = Array.from({ length: width }, (_, index) => ({
    index,
    filled: 0,
    textDates: 0,
    serialDates: 0,
    amounts: 0,
    signedAmounts: 0,
    decimalAmounts: 0,
    text: 0,
    avgTextLen: 0,
  }))
  const textLen = Array(width).fill(0)

  for (let i = start; i < rows.length; i += 1) {
    const row = rows[i]
    for (let col = 0; col < width; col += 1) {
      const cell = (row[col] ?? '').trim()
      if (!cell) continue
      const current = stats[col]
      current.filled += 1
      if (looksLikeTextDate(cell)) current.textDates += 1
      else if (parseBrazilianDate(cell) && /^-?\d+([.,]\d+)?$/.test(cell)) {
        current.serialDates += 1
      }
      if (looksLikeAmount(cell)) {
        current.amounts += 1
        const amount = parseAmount(cell) ?? 0
        if (amount < 0 || cell.trim().startsWith('+')) current.signedAmounts += 1
        if (/[.,]\d/.test(cell)) current.decimalAmounts += 1
      }
      if (hasLetters(cell) && !looksLikeTextDate(cell)) {
        current.text += 1
        textLen[col] += cell.length
      }
    }
  }

  for (const current of stats) {
    current.avgTextLen = current.text ? textLen[current.index] / current.text : 0
  }
  return stats
}

function ratio(part: number, total: number) {
  return total > 0 ? part / total : 0
}

function fillFromContent(map: ColumnMap, rows: string[][], start: number) {
  const stats = columnStats(rows, start)
  const used = new Set(
    (Object.keys(map) as Array<keyof ColumnMap>)
      .filter((key) => key !== 'headerIndex' && map[key] >= 0)
      .map((key) => map[key]),
  )

  if (map.date < 0) {
    const dateCol = [...stats]
      .filter((col) => !used.has(col.index) && col.filled > 0)
      .sort((a, b) => {
        const score = (col: ColStats) =>
          col.textDates * 3 + col.serialDates - col.decimalAmounts
        return score(b) - score(a)
      })[0]
    if (
      dateCol &&
      (ratio(dateCol.textDates, dateCol.filled) >= 0.4 ||
        ratio(dateCol.serialDates, dateCol.filled) >= 0.6)
    ) {
      map.date = dateCol.index
      used.add(dateCol.index)
    }
  }

  if (map.description < 0) {
    const descCol = [...stats]
      .filter((col) => !used.has(col.index) && col.filled > 0)
      .sort((a, b) => {
        const score = (col: ColStats) =>
          col.avgTextLen * 2 + col.text - col.amounts - col.textDates * 4
        return score(b) - score(a)
      })[0]
    if (descCol && (descCol.text > 0 || descCol.avgTextLen >= 6)) {
      map.description = descCol.index
      used.add(descCol.index)
    }
  }

  if (map.amount < 0 && map.debit < 0 && map.credit < 0) {
    const amountCols = [...stats]
      .filter((col) => !used.has(col.index) && col.filled > 0)
      .sort((a, b) => {
        const score = (col: ColStats) =>
          col.decimalAmounts * 3 + col.signedAmounts * 2 + col.amounts - col.textDates * 4
        return score(b) - score(a)
      })
    const amountCol = amountCols[0]
    if (amountCol && ratio(amountCol.amounts, amountCol.filled) >= 0.4) {
      map.amount = amountCol.index
      used.add(amountCol.index)
      if (map.balance < 0) {
        const balanceCol = amountCols.find(
          (col) =>
            !used.has(col.index) &&
            ratio(col.amounts, col.filled) >= 0.5 &&
            col.signedAmounts <= amountCol.signedAmounts,
        )
        if (balanceCol) {
          map.balance = balanceCol.index
          used.add(balanceCol.index)
        }
      }
    }
  }

  return map
}

function isComplete(map: ColumnMap) {
  return (
    map.date >= 0 &&
    map.description >= 0 &&
    (map.amount >= 0 || (map.debit >= 0 && map.credit >= 0))
  )
}

function combineHeaderRows(top: string[], bottom: string[]) {
  const width = Math.max(top.length, bottom.length)
  const combined: string[] = []
  for (let i = 0; i < width; i += 1) {
    const a = (top[i] ?? '').trim()
    const b = (bottom[i] ?? '').trim()
    if (a && b && normalizeHeader(a) !== normalizeHeader(b)) {
      combined[i] = `${a} ${b}`
    } else {
      combined[i] = a || b
    }
  }
  return combined
}

function looksLikeDataRow(row: string[]) {
  let dates = 0
  let amounts = 0
  for (const cell of row) {
    const text = cell ?? ''
    if (parseBrazilianDate(text)) dates += 1
    if (looksLikeAmount(text)) amounts += 1
  }
  return dates >= 1 && amounts >= 1
}

function splitSparseAmountColumns(map: ColumnMap, rows: string[][], start: number) {
  if (map.amount < 0 || map.debit >= 0 || map.credit >= 0) return map
  const stats = columnStats(rows, start)
  const amountCol = stats[map.amount]
  const neighbor = stats[map.amount + 1]
  if (!amountCol || !neighbor || neighbor.filled === 0) return map
  if (ratio(amountCol.filled, Math.max(1, rows.length - start)) >= 0.6) return map
  if (ratio(neighbor.amounts, neighbor.filled) < 0.4) return map
  map.debit = map.amount
  map.credit = neighbor.index
  map.amount = -1
  return map
}

interface HeaderCandidate {
  index: number
  headers: string[]
  score: number
}

function headerCandidates(
  rows: string[][],
  preferredHeaderIndex?: number,
): HeaderCandidate[] {
  const scan = Math.min(rows.length, HEADER_SCAN_ROWS)
  const found: HeaderCandidate[] = []
  const seen = new Set<string>()

  const add = (headers: string[], index: number, bonus: number) => {
    if (index < 0 || index >= rows.length) return
    const score =
      headerRowScore(headers) +
      bonus +
      (preferredHeaderIndex != null && index === preferredHeaderIndex ? 80 : 0)
    const key = `${index}:${headers.map((item) => normalizeHeader(item)).join('|')}`
    if (seen.has(key)) return
    seen.add(key)
    found.push({ index, headers, score })
  }

  for (let i = 0; i < scan; i += 1) {
    const row = rows[i] ?? []
    add(row, i, 0)
    const next = rows[i + 1]
    if (next && !looksLikeDataRow(next) && headerRowScore(next) > 0) {
      add(combineHeaderRows(row, next), i + 1, 35)
    }
  }

  found.sort((a, b) => b.score - a.score || a.index - b.index)
  return found
}

function layoutKey(map: ColumnMap) {
  return [
    map.headerIndex,
    map.date,
    map.description,
    map.amount,
    map.debit,
    map.credit,
  ].join(':')
}

export function detectTabularLayouts(
  rows: string[][],
  options?: TabularLayoutOptions,
): ColumnMap[] {
  if (rows.length === 0) return []

  const maps: ColumnMap[] = []
  const seen = new Set<string>()
  const pushMap = (map: ColumnMap) => {
    if (!isComplete(map)) return
    const key = layoutKey(map)
    if (seen.has(key)) return
    seen.add(key)
    maps.push(map)
  }

  for (const candidate of headerCandidates(rows, options?.preferredHeaderIndex)) {
    if (
      candidate.score < MIN_HEADER_SCORE &&
      candidate.index !== options?.preferredHeaderIndex
    ) {
      continue
    }
    const mapped = mapFromHeaders(candidate.headers)
    mapped.headerIndex = candidate.index
    const dataStart = mapped.headerIndex >= 0 ? mapped.headerIndex + 1 : 0
    pushMap(splitSparseAmountColumns(fillFromContent(mapped, rows, dataStart), rows, dataStart))
  }

  pushMap(fillFromContent(emptyMap(-1), rows, 0))
  return maps
}

export function detectTabularLayout(
  rows: string[][],
  options?: TabularLayoutOptions,
): ColumnMap | null {
  return detectTabularLayouts(rows, options)[0] ?? null
}

function isSkippableRow(description: string, typeLabel: string, amount: number | null) {
  const blob = normalizeHeader(`${description} ${typeLabel}`)
  if (SKIP_DESCRIPTION.test(blob)) return true
  if (blob.includes('saldoinicial') || blob.includes('saldoanterior')) return true
  if (amount === 0) return true
  return false
}

function resolveType(
  signed: number,
  typeLabel: string,
): MovementType {
  const fromLabel = typeFromLabel(typeLabel)
  let amount = signed
  if (fromLabel === 'expense' && amount > 0) amount = -amount
  if (fromLabel === 'income' && amount < 0) amount = Math.abs(amount)
  const fromAmount = typeFromSignedAmount(amount)
  if (fromAmount !== 'unknown') return fromAmount
  return fromLabel ?? 'unknown'
}

export function movementsFromMappedRows(
  rows: string[][],
  map: ColumnMap,
  onWarning: (message: string, row: number) => void,
): RawMovement[] {
  const movements: RawMovement[] = []
  const start = map.headerIndex >= 0 ? map.headerIndex + 1 : 0
  const defaultYear = inferStatementYear(rows.flat().join(' '))
  let lastDate = ''

  for (let i = start; i < rows.length; i += 1) {
    const row = rows[i]
    if (!row || row.every((cell) => !cell?.trim())) continue

    let dateCell = (row[map.date] ?? '').trim()
    if (
      bestRoleForHeader(dateCell)?.role === 'date' &&
      !parseBrazilianDate(dateCell, { defaultYear })
    ) {
      continue
    }
    if (!dateCell && lastDate) dateCell = lastDate

    const posted = parseBrazilianDate(dateCell, { defaultYear })
    const description = row[map.description] ?? ''
    const typeLabel = map.type >= 0 ? row[map.type] ?? '' : ''
    if (!posted || !description.trim()) {
      onWarning('Linha ignorada por data ou descrição vazia', i + 1)
      continue
    }
    lastDate = dateCell

    let signed: number | null = null
    let type: MovementType = 'unknown'

    if (map.amount >= 0) {
      signed = parseAmount(row[map.amount] ?? '')
      if (signed == null && map.debit >= 0 && map.credit >= 0) {
        const credit = parseAmount(row[map.credit] ?? '')
        const debit = parseAmount(row[map.debit] ?? '')
        const mapped = typeFromCreditDebit(credit, debit)
        if (mapped) {
          signed = mapped.type === 'expense' ? -mapped.amount : mapped.amount
          type = resolveType(signed, typeLabel)
        }
      }
      if (signed == null) {
        onWarning('Valor inválido', i + 1)
        continue
      }
      if (type === 'unknown') type = resolveType(signed, typeLabel)
    } else {
      const credit = parseAmount(row[map.credit] ?? '')
      const debit = parseAmount(row[map.debit] ?? '')
      const mapped = typeFromCreditDebit(credit, debit)
      if (!mapped) {
        onWarning('Não foi possível ler crédito/débito', i + 1)
        continue
      }
      signed = mapped.type === 'expense' ? -mapped.amount : mapped.amount
      type = resolveType(signed, typeLabel)
    }

    if (isSkippableRow(description, typeLabel, signed)) continue

    const documentNumber =
      map.document >= 0 ? row[map.document]?.trim() || null : null
    const externalId =
      map.id >= 0 ? row[map.id]?.trim() || null : documentNumber
    const counterparty =
      map.counterparty >= 0 ? row[map.counterparty]?.trim() || null : null

    movements.push({
      postedAt: posted,
      description,
      amount: Math.abs(signed ?? 0),
      type,
      balance: map.balance >= 0 ? parseAmount(row[map.balance] ?? '') : null,
      externalId,
      documentNumber,
      counterparty,
      raw: { row: i + 1 },
    })
  }

  return movements
}
