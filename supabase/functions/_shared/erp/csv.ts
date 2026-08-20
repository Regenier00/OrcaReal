import { detectErpTabularLayout, parseErpTabularRows } from './columns.ts'
import { decodeText } from './inspect.ts'
import { MAX_CSV_LINE_CHARS, MAX_CSV_ROWS } from './limits.ts'
import { emptyResult, finalizeEntries } from './normalize.ts'
import type { DetectedErpFile, ErpParseResult, ErpParser } from './types.ts'

function stripBom(text: string) {
  return text.replace(/^\uFEFF/, '')
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

export function rowsFromCsvText(text: string): string[][] {
  const cleaned = stripBom(text)
  const lines = cleaned
    .split(/\r\n|\n|\r/)
    .map((line) => line.slice(0, MAX_CSV_LINE_CHARS))
    .filter((line) => line.trim().length > 0)

  if (lines.length > MAX_CSV_ROWS) {
    throw new Error(`O CSV tem mais de ${MAX_CSV_ROWS} linhas e foi recusado.`)
  }

  const delimiter = detectDelimiter(lines)
  return lines.map((line) => splitCsvLine(line, delimiter))
}

export const csvErpParser: ErpParser = {
  id: 'csv',
  matches(file) {
    return file.format === 'csv'
  },
  parse(file: DetectedErpFile): ErpParseResult {
    try {
      const text = file.text || decodeText(file.bytes)
      const rows = rowsFromCsvText(text)
      if (rows.length === 0) {
        return emptyResult('csv', [{ message: 'Arquivo sem linhas.' }])
      }
      const detected = detectErpTabularLayout(rows)
      if (!detected) {
        return emptyResult('csv', [
          {
            message:
              'Não foi possível identificar colunas de data, descrição, valor e conta/centro de custo.',
          },
        ])
      }
      const parsed = parseErpTabularRows(rows, detected.map)
      parsed.layout.format = 'csv'
      return finalizeEntries(
        parsed.entries,
        parsed.warnings,
        'csv',
        parsed.layout,
      )
    } catch (error) {
      return emptyResult('csv', [
        {
          message:
            error instanceof Error
              ? `Falha ao ler CSV: ${error.message}`
              : 'Falha ao ler CSV',
        },
      ])
    }
  },
}
