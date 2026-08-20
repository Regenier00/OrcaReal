import {
  cellText,
  excelSerialToIso,
  heuristicMoneyGroup,
  normalizeDescription,
  parseAmount,
  parseBrazilianDate,
  sideFromDebitCredit,
  signedAmount,
  typeFromSide,
  typeFromSigned,
} from './normalize.ts'
import { HEADER_SCAN_ROWS, MIN_HEADER_SCORE } from './limits.ts'
import type {
  DetectedLayout,
  NormalizedErpEntry,
  ParseWarning,
} from './types.ts'

export type ErpColumnRole =
  | 'date'
  | 'description'
  | 'amount'
  | 'debit'
  | 'credit'
  | 'account_code'
  | 'account_name'
  | 'cost_center'
  | 'cost_center_code'
  | 'department'
  | 'document'
  | 'id'

export interface ErpColumnMap {
  headerIndex: number
  date: number
  description: number
  amount: number
  debit: number
  credit: number
  accountCode: number
  accountName: number
  costCenter: number
  costCenterCode: number
  department: number
  document: number
  id: number
}

const ALIASES: Record<ErpColumnRole, string[]> = {
  date: [
    'data',
    'date',
    'datalancamento',
    'datamovimento',
    'datacompetencia',
    'dataemissao',
    'datapagamento',
    'dtlancamento',
    'dtmovimento',
    'dt',
    'posted',
    'competencia',
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
  ],
  debit: [
    'debito',
    'debit',
    'vlrdebito',
    'valordebito',
    'saida',
    'd',
  ],
  credit: [
    'credito',
    'credit',
    'vlrcredito',
    'valorcredito',
    'entrada',
    'c',
  ],
  account_code: [
    'contacontabil',
    'codigoconta',
    'codconta',
    'conta',
    'planocontas',
    'account',
    'accountcode',
    'codigocontacontabil',
    'nroconta',
    'numeroconta',
    'classificacao',
    'contadebito',
    'contacredito',
  ],
  account_name: [
    'nomeconta',
    'descricaoconta',
    'contadescricao',
    'accountname',
    'nomedaconta',
    'descconta',
    'historicoplano',
  ],
  cost_center: [
    'centrocusto',
    'centrodecusto',
    'ccusto',
    'cc',
    'costcenter',
    'nomecentrocusto',
    'descricaocentrocusto',
    'unidadenegocio',
    'area',
  ],
  cost_center_code: [
    'codigocentrocusto',
    'codcc',
    'codcentrocusto',
    'ccodigo',
    'costcentercode',
  ],
  department: [
    'departamento',
    'setor',
    'departamentoarea',
    'depto',
    'department',
    'filial',
    'unidade',
  ],
  document: [
    'documento',
    'docto',
    'nrodoc',
    'numerodocumento',
    'nf',
    'notafiscal',
    'referencia',
    'ref',
  ],
  id: [
    'id',
    'chave',
    'identificador',
    'uuid',
    'idlancamento',
    'sequencia',
    'nrolancamento',
  ],
}

function normalizeHeader(value: unknown) {
  return cellText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

function scoreAlias(header: string, alias: string) {
  if (!header || !alias) return 0
  const compactAlias = alias.replace(/[^a-z0-9]+/g, '')
  if (!compactAlias) return 0
  if (header === compactAlias) return 100
  if (compactAlias.length <= 2) {
    return header === compactAlias ? 90 : 0
  }
  if (header.startsWith(compactAlias)) return compactAlias.length >= 4 ? 85 : 70
  if (compactAlias.length >= 4 && header.includes(compactAlias)) return 75
  if (
    compactAlias.length >= 4 &&
    compactAlias.includes(header) &&
    header.length >= 4
  ) {
    return 60
  }
  return 0
}

function bestRoleScore(header: string, role: ErpColumnRole) {
  let best = 0
  for (const alias of ALIASES[role]) {
    best = Math.max(best, scoreAlias(header, alias))
  }
  return best
}

function scoreHeaderRow(cells: unknown[]) {
  const headers = cells.map(normalizeHeader)
  const roles: ErpColumnRole[] = [
    'date',
    'description',
    'amount',
    'debit',
    'credit',
    'account_code',
    'account_name',
    'cost_center',
    'cost_center_code',
    'department',
    'document',
    'id',
  ]
  const assigned = new Map<ErpColumnRole, { index: number; score: number }>()

  for (let index = 0; index < headers.length; index += 1) {
    const header = headers[index]
    if (!header) continue
    let bestRole: ErpColumnRole | null = null
    let bestScore = 0
    for (const role of roles) {
      const score = bestRoleScore(header, role)
      if (score > bestScore) {
        bestScore = score
        bestRole = role
      }
    }
    if (!bestRole || bestScore < 60) continue
    const current = assigned.get(bestRole)
    if (!current || bestScore > current.score) {
      assigned.set(bestRole, { index, score: bestScore })
    }
  }

  const hasDate = assigned.has('date')
  const hasDescription = assigned.has('description')
  const hasAmount =
    assigned.has('amount') ||
    (assigned.has('debit') && assigned.has('credit')) ||
    assigned.has('debit') ||
    assigned.has('credit')
  const hasAccount =
    assigned.has('account_code') || assigned.has('account_name')

  if (!hasDate || !hasDescription || !hasAmount) {
    return { score: 0, assigned }
  }

  let score = 0
  for (const item of assigned.values()) score += item.score
  if (hasAccount) score += 40
  if (assigned.has('cost_center') || assigned.has('cost_center_code')) score += 30
  if (assigned.has('department')) score += 15
  if (assigned.has('debit') && assigned.has('credit')) score += 25

  return { score, assigned }
}

function mapFromAssigned(
  headerIndex: number,
  assigned: Map<ErpColumnRole, { index: number; score: number }>,
): ErpColumnMap {
  const get = (role: ErpColumnRole) => assigned.get(role)?.index ?? -1
  return {
    headerIndex,
    date: get('date'),
    description: get('description'),
    amount: get('amount'),
    debit: get('debit'),
    credit: get('credit'),
    accountCode: get('account_code'),
    accountName: get('account_name'),
    costCenter: get('cost_center'),
    costCenterCode: get('cost_center_code'),
    department: get('department'),
    document: get('document'),
    id: get('id'),
  }
}

export function detectErpTabularLayout(
  rows: unknown[][],
): { map: ErpColumnMap; score: number } | null {
  const limit = Math.min(rows.length, HEADER_SCAN_ROWS)
  let best: { map: ErpColumnMap; score: number } | null = null

  for (let i = 0; i < limit; i += 1) {
    const { score, assigned } = scoreHeaderRow(rows[i] ?? [])
    if (score < MIN_HEADER_SCORE) continue
    if (!best || score > best.score) {
      best = { map: mapFromAssigned(i, assigned), score }
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

    const accountCode =
      map.accountCode >= 0
        ? cellAt(row, map.accountCode).trim() || null
        : null
    const accountName =
      map.accountName >= 0
        ? cellAt(row, map.accountName).trim() || null
        : null
    const costCenterName =
      map.costCenter >= 0 ? cellAt(row, map.costCenter).trim() || null : null
    const costCenterCode =
      map.costCenterCode >= 0
        ? cellAt(row, map.costCenterCode).trim() || null
        : null
    const departmentName =
      map.department >= 0 ? cellAt(row, map.department).trim() || null : null
    const documentNumber =
      map.document >= 0 ? cellAt(row, map.document).trim() || null : null
    const externalId = map.id >= 0 ? cellAt(row, map.id).trim() || null : null

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
      departmentName,
      documentNumber,
      externalId,
      suggestedMoneyGroup: hint?.moneyGroup ?? null,
      suggestedDestinationName: hint?.destinationName ?? null,
      suggestionSource: hint ? 'heuristic' : null,
      raw: {
        row: r + 1,
        cells: row.map(cellText),
      },
    })
  }

  const columns: Record<string, number> = {
    date: map.date,
    description: map.description,
    amount: map.amount,
    debit: map.debit,
    credit: map.credit,
    account_code: map.accountCode,
    account_name: map.accountName,
    cost_center: map.costCenter,
    cost_center_code: map.costCenterCode,
    department: map.department,
    document: map.document,
    id: map.id,
  }

  return {
    entries,
    warnings,
    layout: {
      format: 'xlsx',
      headerIndex: map.headerIndex,
      columns,
    },
  }
}
