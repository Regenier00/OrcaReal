/**
 * Detecção de colunas do importador ERP.
 *
 * Inspirado no Odoo base_import:
 * 1) mapeamentos salvos da empresa (prioridade máxima)
 * 2) match exato de aliases
 * 3) fuzzy match (distância de sequência) com limiar
 * 4) colunas irrelevantes → ignore (não mapeamos)
 *
 * Campos-alvo: data, valor, descrição, centro de custo, conta contábil.
 * Débito/crédito só existem como fonte alternativa de "valor".
 */

import {
  cellText,
  excelSerialToIso,
  heuristicMoneyGroup,
  normalizeDescription,
  parseAmount,
  parseBrazilianDate,
  sanitizeSpreadsheetText,
  sideFromDebitCredit,
  signedAmount,
  typeFromSide,
  typeFromSigned,
} from './normalize.ts'
import { FUZZY_MATCH_DISTANCE, HEADER_SCAN_ROWS, MIN_HEADER_SCORE } from './limits.ts'
import type {
  DetectedLayout,
  NormalizedErpEntry,
  ParseWarning,
} from './types.ts'

/** Papéis que importamos. Tudo fora disso é descartado. */
export type ErpFieldRole =
  | 'date'
  | 'description'
  | 'amount'
  | 'debit'
  | 'credit'
  | 'account'
  | 'cost_center'
  | 'ignore'

export interface ErpColumnMap {
  headerIndex: number
  date: number
  description: number
  amount: number
  debit: number
  credit: number
  account: number
  costCenter: number
  /** Cabeçalhos detectados → papel (para salvar mapeamento). */
  headerRoles: Array<{ header: string; role: ErpFieldRole; index: number }>
}

export type SavedHeaderMap = Record<string, ErpFieldRole>

const CORE_ROLES: ErpFieldRole[] = [
  'date',
  'description',
  'amount',
  'debit',
  'credit',
  'account',
  'cost_center',
]

const ALIASES: Record<Exclude<ErpFieldRole, 'ignore'>, string[]> = {
  date: [
    'data',
    'datalancamento',
    'datamovimento',
    'datacompetencia',
    'dataemissao',
    'datapagamento',
    'dtlancamento',
    'dtmovimento',
    'posted',
    'competencia',
    'date',
  ],
  description: [
    'descricao',
    'historico',
    'historicodescricao',
    'complemento',
    'memo',
    'description',
    'observacao',
    'narrativa',
    'lancamento',
    'detalhe',
    'detalhes',
    'titulo',
  ],
  amount: [
    'valor',
    'amount',
    'value',
    'vlr',
    'valorlancamento',
    'valormovimento',
    'valorrs',
    'valorliquido',
    'valorbruto',
    'valormovimentacao',
  ],
  debit: ['debito', 'debit', 'vlrdebito', 'valordebito', 'saida'],
  credit: ['credito', 'credit', 'vlrcredito', 'valorcredito', 'entrada'],
  account: [
    'contacontabil',
    'codigoconta',
    'codconta',
    'conta',
    'planocontas',
    'account',
    'accountcode',
    'accountname',
    'codigocontacontabil',
    'nroconta',
    'numeroconta',
    'nomeconta',
    'descricaoconta',
    'contadescricao',
    'classificacao',
  ],
  cost_center: [
    'centrocusto',
    'centrodecusto',
    'ccusto',
    'costcenter',
    'costcentercode',
    'nomecentrocusto',
    'descricaocentrocusto',
    'codigocentrocusto',
    'codcentrocusto',
    'codcc',
  ],
}

/** Cabeçalhos tipicamente irrelevantes — forçamos ignore. */
const IGNORE_ALIASES = [
  'saldo',
  'balance',
  'documento',
  'docto',
  'nrodoc',
  'numerodocumento',
  'nf',
  'notafiscal',
  'id',
  'chave',
  'uuid',
  'sequencia',
  'filial',
  'empresa',
  'cnpj',
  'cpf',
  'moeda',
  'currency',
  'usuario',
  'user',
  'status',
  'situacao',
  'lote',
  'origem',
  'tipo',
  'nature',
  'natureza',
  'departamento',
  'setor',
  'depto',
  'department',
]

export function normalizeHeader(value: unknown) {
  return cellText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

/** Distância 0 = igual, 1 = totalmente diferente (Odoo SequenceMatcher). */
export function stringDistance(a: string, b: string) {
  if (!a || !b) return 1
  if (a === b) return 0
  const left = a.length >= b.length ? a : b
  const right = a.length >= b.length ? b : a
  const rows = right.length + 1
  const cols = left.length + 1
  const matrix: number[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0),
  )
  for (let i = 0; i < rows; i += 1) matrix[i][0] = i
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = right[i - 1] === left[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      )
    }
  }
  const edits = matrix[right.length][left.length]
  return edits / Math.max(left.length, 1)
}

function scoreAlias(header: string, alias: string) {
  if (!header || !alias) return 0
  // Aliases curtos (≤2) geram falso positivo — alinhado ao extrato e ao Odoo.
  if (alias.length <= 2) return 0
  if (header === alias) return 100
  if (header.startsWith(alias)) return alias.length >= 4 ? 85 : 70
  if (alias.length >= 4 && header.includes(alias)) return 75
  if (alias.length >= 4 && alias.includes(header) && header.length >= 4) return 60
  const distance = stringDistance(header, alias)
  if (distance <= FUZZY_MATCH_DISTANCE) {
    return Math.round(90 * (1 - distance))
  }
  return 0
}

function bestRoleForHeader(
  header: string,
  saved?: SavedHeaderMap,
): { role: ErpFieldRole; score: number } {
  if (!header) return { role: 'ignore', score: 0 }

  const savedRole = saved?.[header]
  if (savedRole) return { role: savedRole, score: 200 }

  for (const ignore of IGNORE_ALIASES) {
    if (header === ignore || (ignore.length >= 4 && header.includes(ignore))) {
      return { role: 'ignore', score: 100 }
    }
  }

  let bestRole: ErpFieldRole = 'ignore'
  let bestScore = 0
  for (const role of CORE_ROLES) {
    for (const alias of ALIASES[role]) {
      const score = scoreAlias(header, alias)
      if (score > bestScore) {
        bestScore = score
        bestRole = role
      }
    }
  }

  if (bestScore < 60) return { role: 'ignore', score: bestScore }
  return { role: bestRole, score: bestScore }
}

function scoreHeaderRow(cells: unknown[], saved?: SavedHeaderMap) {
  const headers = cells.map(normalizeHeader)
  const assigned = new Map<ErpFieldRole, { index: number; score: number; header: string }>()
  const headerRoles: ErpColumnMap['headerRoles'] = []

  for (let index = 0; index < headers.length; index += 1) {
    const header = headers[index]
    if (!header) continue
    const { role, score } = bestRoleForHeader(header, saved)
    headerRoles.push({ header, role, index })
    if (role === 'ignore' || score < 60) continue
    const current = assigned.get(role)
    if (!current || score > current.score) {
      assigned.set(role, { index, score, header })
    }
  }

  const hasDate = assigned.has('date')
  const hasDescription = assigned.has('description')
  const hasAmount =
    assigned.has('amount') ||
    assigned.has('debit') ||
    assigned.has('credit')

  if (!hasDate || !hasDescription || !hasAmount) {
    return { score: 0, assigned, headerRoles }
  }

  let score = 0
  for (const item of assigned.values()) score += item.score
  // Prefer layouts que trazem conta e centro de custo (campos-alvo).
  if (assigned.has('account')) score += 50
  if (assigned.has('cost_center')) score += 50
  if (assigned.has('debit') && assigned.has('credit')) score += 20

  return { score, assigned, headerRoles }
}

function mapFromAssigned(
  headerIndex: number,
  assigned: Map<ErpFieldRole, { index: number; score: number; header: string }>,
  headerRoles: ErpColumnMap['headerRoles'],
): ErpColumnMap {
  const get = (role: ErpFieldRole) => assigned.get(role)?.index ?? -1
  return {
    headerIndex,
    date: get('date'),
    description: get('description'),
    amount: get('amount'),
    debit: get('debit'),
    credit: get('credit'),
    account: get('account'),
    costCenter: get('cost_center'),
    headerRoles,
  }
}

export function detectErpTabularLayout(
  rows: unknown[][],
  saved?: SavedHeaderMap,
): { map: ErpColumnMap; score: number } | null {
  const limit = Math.min(rows.length, HEADER_SCAN_ROWS)
  let best: { map: ErpColumnMap; score: number } | null = null

  for (let i = 0; i < limit; i += 1) {
    const { score, assigned, headerRoles } = scoreHeaderRow(rows[i] ?? [], saved)
    if (score < MIN_HEADER_SCORE) continue
    if (!best || score > best.score) {
      best = { map: mapFromAssigned(i, assigned, headerRoles), score }
    }
  }

  return best
}

function cellAt(row: unknown[], index: number) {
  if (index < 0 || index >= row.length) return ''
  return cellText(row[index])
}

const STOP_ROW =
  /(?:^|\s)(?:totais?|total\s+geral|resumo|subtotal|soma)(?:\s|$)/i

function looksLikeAccountCode(value: string) {
  const text = value.trim()
  // Código típico de plano/CC: precisa ter dígito (ex.: 3.1.01, CC-01).
  if (!/\d/.test(text)) return false
  return (
    /^[\d][\d.\/\-A-Za-z]*$/.test(text) ||
    /^[A-Z]{1,5}[\d.\-]{1,20}$/i.test(text)
  )
}

export function parseErpTabularRows(
  rows: unknown[][],
  map: ErpColumnMap,
): { entries: NormalizedErpEntry[]; warnings: ParseWarning[]; layout: DetectedLayout } {
  const entries: NormalizedErpEntry[] = []
  const warnings: ParseWarning[] = []
  const yearHint = new Date().getUTCFullYear()

  for (let r = map.headerIndex + 1; r < rows.length; r += 1) {
    const row = rows[r] ?? []
    const rowText = row.map(cellText).join(' ').trim()
    if (!rowText) continue
    if (STOP_ROW.test(rowText) && entries.length > 0) break

    const dateRaw = cellAt(row, map.date)
    let postedAt =
      parseBrazilianDate(dateRaw, yearHint) ||
      (typeof row[map.date] === 'number'
        ? excelSerialToIso(row[map.date] as number)
        : null)
    if (!postedAt) {
      if (dateRaw) {
        warnings.push({ message: `Data inválida na linha ${r + 1}.`, row: r + 1 })
      }
      continue
    }

    const description = normalizeDescription(cellAt(row, map.description))
    if (!description) continue

    let entrySide: NormalizedErpEntry['entrySide'] = 'unknown'
    let amount = 0
    let type: NormalizedErpEntry['type'] = 'unknown'

    const debit = map.debit >= 0 ? parseAmount(cellAt(row, map.debit)) : null
    const credit = map.credit >= 0 ? parseAmount(cellAt(row, map.credit)) : null
    const fromSides = sideFromDebitCredit(debit, credit)

    if (fromSides) {
      entrySide = fromSides.side
      amount = fromSides.amount
      type = typeFromSide(entrySide)
    } else if (map.amount >= 0) {
      const signed = signedAmount(cellAt(row, map.amount))
      if (signed == null || signed === 0) continue
      const resolved = typeFromSigned(signed)
      entrySide = resolved.side
      amount = resolved.amount
      type = resolved.type
    } else {
      continue
    }

    if (amount <= 0) continue

    const accountRaw =
      map.account >= 0
        ? sanitizeSpreadsheetText(cellAt(row, map.account), 200)
        : ''
    let accountCode: string | null = null
    let accountName: string | null = null
    if (accountRaw) {
      if (looksLikeAccountCode(accountRaw)) {
        accountCode = sanitizeSpreadsheetText(accountRaw, 80) || null
      } else {
        accountName = accountRaw || null
      }
    }

    const costCenterRaw =
      map.costCenter >= 0
        ? sanitizeSpreadsheetText(cellAt(row, map.costCenter), 200)
        : ''
    let costCenterCode: string | null = null
    let costCenterName: string | null = null
    if (costCenterRaw) {
      if (looksLikeAccountCode(costCenterRaw) && costCenterRaw.length <= 40) {
        costCenterCode = sanitizeSpreadsheetText(costCenterRaw, 80) || null
      } else {
        costCenterName = costCenterRaw || null
      }
    }

    const hint = heuristicMoneyGroup({
      accountCode,
      accountName,
      costCenterName,
      description,
    })

    entries.push({
      postedAt,
      description,
      amount,
      entrySide,
      type,
      accountCode,
      accountName,
      costCenterCode,
      costCenterName,
      departmentName: null,
      documentNumber: null,
      externalId: null,
      suggestedMoneyGroup: hint?.moneyGroup ?? null,
      suggestedDestinationName: hint?.destinationName ?? null,
      suggestionSource: hint ? 'heuristic' : null,
      raw: {
        row: r + 1,
      },
    })
  }

  const columns: Record<string, number> = {
    date: map.date,
    description: map.description,
    amount: map.amount,
    debit: map.debit,
    credit: map.credit,
    account: map.account,
    cost_center: map.costCenter,
  }

  return {
    entries,
    warnings,
    layout: {
      format: 'xlsx',
      headerIndex: map.headerIndex,
      columns,
      headerRoles: map.headerRoles.map((item) => ({
        header: item.header,
        role: item.role,
      })),
    },
  }
}

export function mappingsPayloadFromLayout(map: ErpColumnMap) {
  return map.headerRoles
    .filter((item) => item.header)
    .map((item) => ({
      header: item.header,
      role: item.role,
    }))
}
