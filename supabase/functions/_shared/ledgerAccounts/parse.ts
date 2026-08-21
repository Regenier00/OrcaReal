import { readFirstXlsxSheetRows } from '../erp/xlsx.ts'
import {
  MAX_LEDGER_ACCOUNT_CODE,
  MAX_LEDGER_ACCOUNT_NAME,
  MAX_LEDGER_ACCOUNT_ROWS,
} from './limits.ts'

export type LedgerAccountColumnRole = 'account_code' | 'account_name' | 'ignore'

export interface LedgerAccountImportRow {
  account_code: string
  account_name: string
  row: number
}

export interface LedgerAccountParseResult {
  rows: LedgerAccountImportRow[]
  warnings: Array<{ message: string; row?: number }>
  layout: {
    format: 'xlsx' | 'csv'
    sheetName: string
    headerRow: number
    columns: Record<string, number>
  }
}

function normalizeHeader(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function roleFromHeader(header: string): LedgerAccountColumnRole | null {
  const key = normalizeHeader(header)
  if (!key) return null

  if (
    [
      'numero',
      'numerodaconta',
      'conta',
      'contacontabil',
      'codigoconta',
      'codigo',
      'code',
      'account',
      'accountcode',
      'accountnumber',
      'nro',
      'nr',
    ].includes(key) ||
    (key.includes('numero') && key.includes('conta')) ||
    (key.includes('codigo') && key.includes('conta'))
  ) {
    return 'account_code'
  }

  if (
    [
      'descricao',
      'descricaodaconta',
      'nomedaconta',
      'nome',
      'name',
      'accountname',
      'description',
      'desc',
    ].includes(key) ||
    (key.includes('descricao') && key.includes('conta')) ||
    (key.includes('nome') && key.includes('conta'))
  ) {
    return 'account_name'
  }

  return null
}

function trimCell(value: unknown, max: number) {
  const text = String(value ?? '')
    .replace(/\u0000/g, '')
    .replace(/^[=+\-@|]+/, '')
    .trim()
  if (!text) return ''
  return text.slice(0, max)
}

function detectHeader(rows: string[][]) {
  const scan = Math.min(rows.length, 30)
  let best: {
    rowIndex: number
    map: Partial<Record<LedgerAccountColumnRole, number>>
    score: number
  } | null = null

  for (let i = 0; i < scan; i += 1) {
    const row = rows[i] ?? []
    const map: Partial<Record<LedgerAccountColumnRole, number>> = {}
    let score = 0
    for (let col = 0; col < row.length; col += 1) {
      const role = roleFromHeader(String(row[col] ?? ''))
      if (!role || role === 'ignore') continue
      if (map[role] != null) continue
      map[role] = col
      score += role === 'account_code' ? 100 : 80
    }
    if (map.account_code == null || map.account_name == null) continue
    if (!best || score > best.score) {
      best = { rowIndex: i, map, score }
    }
  }

  return best
}

function parseMatrix(
  matrix: string[][],
  format: 'xlsx' | 'csv',
  sheetName: string,
): LedgerAccountParseResult {
  const warnings: LedgerAccountParseResult['warnings'] = []
  const detected = detectHeader(matrix)

  // Obrigatório: coluna 1 = número, coluna 2 = descrição (quando sem cabeçalho).
  const headerRow = detected?.rowIndex ?? -1
  const codeCol = detected?.map.account_code ?? 0
  const nameCol = detected?.map.account_name ?? 1
  const startRow = headerRow >= 0 ? headerRow + 1 : 0

  if (headerRow < 0) {
    warnings.push({
      message:
        'Cabeçalho não identificado; usando coluna 1 = número da conta e coluna 2 = descrição.',
    })
  }

  const rows: LedgerAccountImportRow[] = []

  for (let i = startRow; i < matrix.length; i += 1) {
    if (rows.length >= MAX_LEDGER_ACCOUNT_ROWS) {
      warnings.push({
        message: `Limite de ${MAX_LEDGER_ACCOUNT_ROWS} linhas atingido; demais linhas foram ignoradas.`,
      })
      break
    }

    const line = matrix[i] ?? []
    // Suporte a "3.4.01.0001 | RATEIO DEPARTAMENTOS" numa única célula
    if (
      (line[codeCol] == null || String(line[codeCol]).trim() === '') &&
      line.length === 1 &&
      String(line[0] ?? '').includes('|')
    ) {
      const [left, ...rest] = String(line[0]).split('|')
      const code = trimCell(left, MAX_LEDGER_ACCOUNT_CODE)
      const name = trimCell(rest.join('|'), MAX_LEDGER_ACCOUNT_NAME)
      if (!code || !name) continue
      rows.push({ account_code: code, account_name: name, row: i + 1 })
      continue
    }

    const code = trimCell(line[codeCol], MAX_LEDGER_ACCOUNT_CODE)
    const name = trimCell(line[nameCol], MAX_LEDGER_ACCOUNT_NAME)
    if (!code && !name) continue
    if (!code || !name) {
      warnings.push({
        message: 'Linha ignorada: número e descrição da conta são obrigatórios.',
        row: i + 1,
      })
      continue
    }

    // Não aplica regra de negócio aqui: duplicatas/upsert ficam na RPC.
    rows.push({
      account_code: code,
      account_name: name,
      row: i + 1,
    })
  }

  if (rows.length === 0) {
    throw new Error(
      'Nenhuma conta encontrada. Use coluna 1 = Número da conta e coluna 2 = Descrição.',
    )
  }

  return {
    rows,
    warnings,
    layout: {
      format,
      sheetName,
      headerRow: headerRow + 1,
      columns: {
        account_code: codeCol,
        account_name: nameCol,
      },
    },
  }
}

function parseCsvText(text: string): string[][] {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n').filter((line) => line.trim().length > 0)
  return lines.map((line) => {
    if (line.includes('\t')) {
      return line.split('\t').map((cell) => cell.trim())
    }
    if (line.includes(';') && !line.includes(',')) {
      return line.split(';').map((cell) => cell.trim())
    }
    if (line.includes('|') && !line.includes(',') && !line.includes(';')) {
      return line.split('|').map((cell) => cell.trim())
    }
    // CSV simples com aspas
    const cells: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i += 1
        } else {
          inQuotes = !inQuotes
        }
        continue
      }
      if (ch === ',' && !inQuotes) {
        cells.push(current.trim())
        current = ''
        continue
      }
      current += ch
    }
    cells.push(current.trim())
    return cells
  })
}

export async function parseLedgerAccountXlsx(
  bytes: Uint8Array,
): Promise<LedgerAccountParseResult> {
  const { sheetName, rows: matrix } = await readFirstXlsxSheetRows(bytes)
  return parseMatrix(matrix, 'xlsx', sheetName)
}

export function parseLedgerAccountCsv(bytes: Uint8Array): LedgerAccountParseResult {
  const text = new TextDecoder('utf-8').decode(bytes)
  const matrix = parseCsvText(text)
  return parseMatrix(matrix, 'csv', 'csv')
}

export async function parseLedgerAccountFile(input: {
  bytes: Uint8Array
  format: 'xlsx' | 'csv'
}): Promise<LedgerAccountParseResult> {
  if (input.format === 'csv') {
    return parseLedgerAccountCsv(input.bytes)
  }
  return parseLedgerAccountXlsx(input.bytes)
}
