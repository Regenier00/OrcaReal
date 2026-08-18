import { detectBank } from './banks.ts'
import {
  detectTabularLayout,
  movementsFromMappedRows,
} from './columns.ts'
import { MAX_CSV_LINE_CHARS, MAX_CSV_ROWS, MAX_WARNINGS } from './limits.ts'
import { capWarnings, emptyResult, finalizeMovements } from './normalize.ts'
import type { DetectedFile, ParseResult, StatementParser } from './types.ts'

function stripBom(text: string) {
  return text.replace(/^\uFEFF/, '')
}

function detectDelimiter(lines: string[]) {
  const candidates = [';', '\t', ',', '|'] as const
  const sample = lines.slice(0, 40)
  let best: (typeof candidates)[number] = ';'
  let bestScore = -1

  for (const candidate of candidates) {
    const counts = sample
      .map((line) => splitCsvLine(line, candidate).filter((cell) => cell).length)
      .filter((count) => count >= 3)
    if (counts.length === 0) continue

    const freq = new Map<number, number>()
    for (const count of counts) freq.set(count, (freq.get(count) ?? 0) + 1)
    let modeFreq = 0
    let modeCount = 0
    for (const [count, n] of freq) {
      if (n > modeFreq) {
        modeFreq = n
        modeCount = count
      }
    }
    const preferred = candidate === ';' || candidate === '\t' ? 2 : 0
    const score = modeFreq * 10 + modeCount + preferred
    if (score > bestScore) {
      best = candidate
      bestScore = score
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

function denseRow(row: string[]) {
  const next = Array<string>(row.length)
  for (let i = 0; i < row.length; i += 1) {
    next[i] = row[i] ?? ''
  }
  return next
}

export function parseTabularRows(rows: string[][]): ParseResult {
  const result = emptyResult('csv')
  rows = rows.map(denseRow)
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

  const layout = detectTabularLayout(rows)
  if (!layout) {
    result.warnings.push({
      message:
        'Não foi possível identificar as colunas de data, descrição e valor neste extrato.',
    })
    return result
  }

  const movements = movementsFromMappedRows(rows, layout, (message, row) => {
    if (result.warnings.length > MAX_WARNINGS * 4) return
    result.warnings.push({ message, row })
  })

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

    const delimiter = detectDelimiter(lines)
    const rows = lines.map((line) => splitCsvLine(line, delimiter))
    const result = parseTabularRows(rows)
    result.format = 'csv'
    result.bankCode = detected.bankCode
    result.bankName = detected.bankName
    result.warnings = capWarnings(result.warnings)
    return result
  },
}
