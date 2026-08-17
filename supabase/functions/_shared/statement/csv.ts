import { detectBank } from './banks.ts'
import { MAX_CSV_LINE_CHARS, MAX_CSV_ROWS, MAX_WARNINGS } from './limits.ts'
import {
  capWarnings,
  emptyResult,
  finalizeMovements,
  parseAmount,
  parseBrazilianDate,
  typeFromCreditDebit,
  typeFromSignedAmount,
} from './normalize.ts'
import type {
  DetectedFile,
  ParseResult,
  RawMovement,
  StatementParser,
} from './types.ts'

const DATE_HEADERS = ['data', 'date', 'dtposted', 'datalancamento', 'datamovimento', 'posted']
const DESC_HEADERS = ['descricao', 'historico', 'memo', 'description', 'detalhes', 'lancamento', 'historico']
const AMOUNT_HEADERS = ['valor', 'amount', 'trnamt', 'valorrs']
const DEBIT_HEADERS = ['debito', 'debit', 'saida', 'd']
const CREDIT_HEADERS = ['credito', 'credit', 'entrada', 'c']
const BALANCE_HEADERS = ['saldo', 'balance']
const ID_HEADERS = ['id', 'fitid', 'documento', 'nrodoc', 'numero']

function stripBom(text: string) {
  return text.replace(/^\uFEFF/, '')
}

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

function detectDelimiter(headerLine: string) {
  const candidates = [';', '\t', ',', '|'] as const
  let best: (typeof candidates)[number] = ';'
  let bestCount = -1
  for (const candidate of candidates) {
    const count = headerLine.split(candidate).length
    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  }
  return best
}

function splitCsvLine(line: string, delimiter: string) {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current.trim())
  return cells
}

function findColumn(headers: string[], names: string[]) {
  return headers.findIndex((header) => names.includes(header))
}

export function parseTabularRows(rows: string[][]): ParseResult {
  const result = emptyResult('csv')
  if (rows.length === 0) {
    result.warnings.push({ message: 'Arquivo sem linhas' })
    return result
  }
  if (rows.length > MAX_CSV_ROWS) {
    result.warnings.push({
      message: `A planilha tem mais de ${MAX_CSV_ROWS} linhas e foi recusada.`,
    })
    return result
  }

  let headerIndex = 0
  let headers = rows[0].map(normalizeHeader)
  const looksLikeHeader = headers.some((header) =>
    [...DATE_HEADERS, ...DESC_HEADERS, ...AMOUNT_HEADERS].includes(header),
  )

  if (!looksLikeHeader) {
    const found = rows.findIndex((row) =>
      row.map(normalizeHeader).some((header) => DATE_HEADERS.includes(header)),
    )
    if (found >= 0) {
      headerIndex = found
      headers = rows[found].map(normalizeHeader)
    }
  }

  const dateCol = findColumn(headers, DATE_HEADERS)
  const descCol = findColumn(headers, DESC_HEADERS)
  const amountCol = findColumn(headers, AMOUNT_HEADERS)
  const debitCol = findColumn(headers, DEBIT_HEADERS)
  const creditCol = findColumn(headers, CREDIT_HEADERS)
  const balanceCol = findColumn(headers, BALANCE_HEADERS)
  const idCol = findColumn(headers, ID_HEADERS)

  if (dateCol < 0 || descCol < 0 || (amountCol < 0 && debitCol < 0 && creditCol < 0)) {
    result.warnings.push({
      message:
        'Não foi possível identificar as colunas de data, descrição e valor. Use um CSV/XLSX com cabeçalho.',
    })
    return result
  }

  const movements: RawMovement[] = []
  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i]
    if (row.every((cell) => !cell)) continue
    const posted = parseBrazilianDate(row[dateCol] ?? '')
    const description = row[descCol] ?? ''
    if (result.warnings.length > MAX_WARNINGS * 4) continue
    if (!posted || !description) {
      result.warnings.push({ message: 'Linha ignorada por data ou descrição vazia', row: i + 1 })
      continue
    }

    let amount = 0
    let type = typeFromSignedAmount(0, description)
    if (amountCol >= 0) {
      const signed = parseAmount(row[amountCol] ?? '')
      if (signed == null) {
        result.warnings.push({ message: 'Valor inválido', row: i + 1 })
        continue
      }
      amount = Math.abs(signed)
      type = typeFromSignedAmount(signed, description)
    } else {
      const credit = parseAmount(row[creditCol] ?? '')
      const debit = parseAmount(row[debitCol] ?? '')
      const mapped = typeFromCreditDebit(credit, debit, description)
      if (!mapped) {
        result.warnings.push({ message: 'Não foi possível ler crédito/débito', row: i + 1 })
        continue
      }
      amount = mapped.amount
      type = mapped.type
    }

    movements.push({
      postedAt: posted,
      description,
      amount,
      type,
      balance: balanceCol >= 0 ? parseAmount(row[balanceCol] ?? '') : null,
      externalId: idCol >= 0 ? row[idCol] || null : null,
      documentNumber: null,
      counterparty: null,
      raw: { row: i + 1 },
    })
  }

  result.movements = finalizeMovements(movements)
  result.warnings = capWarnings(result.warnings)
  return result
}

export const csvParser: StatementParser = {
  id: 'csv',
  matches(file) {
    return file.format === 'csv'
  },
  parse(file: DetectedFile): ParseResult {
    const text = stripBom(file.text)
    const detected = detectBank(text.slice(0, 4000))
    const lines = text.split(/\r?\n/).filter((line) => line.trim())
    if (lines.length === 0) {
      const result = emptyResult('csv')
      result.warnings.push({ message: 'CSV vazio' })
      return result
    }

    if (lines.length > MAX_CSV_ROWS) {
      const result = emptyResult('csv')
      result.warnings.push({
        message: `O CSV tem mais de ${MAX_CSV_ROWS} linhas e foi recusado.`,
      })
      return result
    }
    if (lines.some((line) => line.length > MAX_CSV_LINE_CHARS)) {
      const result = emptyResult('csv')
      result.warnings.push({
        message: 'O CSV contém uma linha longa demais e foi recusado.',
      })
      return result
    }

    const delimiter = detectDelimiter(lines[0])
    const rows = lines.map((line) => splitCsvLine(line, delimiter))
    const result = parseTabularRows(rows)
    result.format = 'csv'
    result.bankCode = detected.bankCode
    result.bankName = detected.bankName
    result.warnings = capWarnings(result.warnings)
    return result
  },
}
