import { parseTabularRows } from './csv.ts'
import { detectBank } from './banks.ts'
import { inflateLimited } from './inflate.ts'
import {
  MAX_UNCOMPRESSED_ENTRY,
  MAX_UNCOMPRESSED_TOTAL,
  MAX_ZIP_ENTRIES,
} from './limits.ts'
import { emptyResult } from './normalize.ts'
import type { DetectedFile, ParseResult, StatementParser } from './types.ts'

function readU16(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function readU32(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0
}

async function inflateRaw(data: Uint8Array) {
  return inflateLimited(data, 'deflate-raw', MAX_UNCOMPRESSED_ENTRY)
}

function isSafeZipName(name: string) {
  const normalized = name.replaceAll('\\', '/')
  return (
    Boolean(normalized) &&
    !normalized.startsWith('/') &&
    !normalized.includes('..') &&
    normalized.length < 180
  )
}

function normalizeZipName(name: string) {
  return name.replaceAll('\\', '/')
}

function isNeededXlsxEntry(name: string) {
  const normalized = normalizeZipName(name)
  return (
    normalized === '[Content_Types].xml' ||
    /^xl\/sharedStrings\.xml$/i.test(normalized) ||
    /^xl\/worksheets\/[^/]+\.xml$/i.test(normalized)
  )
}

function findFile(
  files: Map<string, Uint8Array>,
  test: (name: string) => boolean,
) {
  for (const [name, content] of files) {
    if (test(name)) return content
  }
  return undefined
}

function worksheetEntries(files: Map<string, Uint8Array>) {
  return [...files.entries()]
    .filter(([name]) => /^xl\/worksheets\/[^/]+\.xml$/i.test(name))
    .sort(([left], [right]) =>
      left.localeCompare(right, undefined, { numeric: true }),
    )
}

async function unzip(bytes: Uint8Array) {
  const files = new Map<string, Uint8Array>()
  const searchWindow = Math.min(bytes.length, 65_536)
  let offset = bytes.length - 22
  const minOffset = bytes.length - searchWindow
  while (offset >= minOffset && readU32(bytes, offset) !== 0x06054b50) {
    offset -= 1
  }
  if (offset < minOffset || readU32(bytes, offset) !== 0x06054b50) {
    throw new Error('Arquivo XLSX inválido')
  }

  const cdOffset = readU32(bytes, offset + 16)
  const cdEntries = readU16(bytes, offset + 10)
  if (cdEntries > MAX_ZIP_ENTRIES) {
    throw new Error('A planilha tem entradas demais e foi recusada.')
  }
  if (cdOffset >= bytes.length) throw new Error('Arquivo XLSX inválido')

  let cursor = cdOffset
  let totalUncompressed = 0

  for (let i = 0; i < cdEntries; i += 1) {
    if (cursor + 46 > bytes.length || readU32(bytes, cursor) !== 0x02014b50) break
    const method = readU16(bytes, cursor + 10)
    const compressedSize = readU32(bytes, cursor + 20)
    const uncompressedSize = readU32(bytes, cursor + 24)
    const nameLength = readU16(bytes, cursor + 28)
    const extraLength = readU16(bytes, cursor + 30)
    const commentLength = readU16(bytes, cursor + 32)
    const localOffset = readU32(bytes, cursor + 42)
    if (cursor + 46 + nameLength > bytes.length) break
    const name = new TextDecoder().decode(
      bytes.slice(cursor + 46, cursor + 46 + nameLength),
    )
    cursor += 46 + nameLength + extraLength + commentLength

    if (!isSafeZipName(name) || !isNeededXlsxEntry(name)) continue
    if (method !== 0 && method !== 8) continue
    if (uncompressedSize > MAX_UNCOMPRESSED_ENTRY) {
      throw new Error('A planilha compactada excede o limite seguro de leitura.')
    }
    if (localOffset + 30 > bytes.length) continue
    const localNameLength = readU16(bytes, localOffset + 26)
    const localExtraLength = readU16(bytes, localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    if (dataStart + compressedSize > bytes.length) continue
    const compressed = bytes.slice(dataStart, dataStart + compressedSize)
    const content = method === 0 ? compressed : await inflateRaw(compressed)
    if (content.byteLength > MAX_UNCOMPRESSED_ENTRY) {
      throw new Error('A planilha compactada excede o limite seguro de leitura.')
    }
    totalUncompressed += content.byteLength
    if (totalUncompressed > MAX_UNCOMPRESSED_TOTAL) {
      throw new Error('A planilha compactada excede o limite seguro de leitura.')
    }
    files.set(normalizeZipName(name), content)
  }

  return files
}

function decodeXml(bytes: Uint8Array) {
  return new TextDecoder('utf-8').decode(bytes)
}

function unescapeXml(value: string | undefined) {
  return String(value ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function xmlInner(xml: string, tag: string) {
  const match = xml.match(
    new RegExp(
      `<(?:[\\w.-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${tag}>`,
      'i',
    ),
  )
  return match?.[1]
}

function parseSharedStrings(xml: string) {
  if (xml.length > 2_000_000) {
    throw new Error('A planilha é grande demais para leitura segura.')
  }
  const values: string[] = []
  const items =
    xml.match(/<(?:[\w.-]+:)?si\b[\s\S]*?<\/(?:[\w.-]+:)?si>/gi) ?? []
  for (const item of items) {
    const texts = [
      ...item.matchAll(
        /<(?:[\w.-]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?t>/gi,
      ),
    ].map((match) => unescapeXml(match[1]))
    values.push(texts.join(''))
  }
  return values
}

function columnIndex(ref: string) {
  const letters = ref.replace(/[^A-Za-z]/g, '').toUpperCase()
  if (!letters) return -1
  let index = 0
  for (const char of letters) {
    const code = char.charCodeAt(0) - 64
    if (code < 1 || code > 26) return -1
    index = index * 26 + code
  }
  return index - 1
}

function parseCellRef(ref: string) {
  const match = ref.toUpperCase().match(/^([A-Z]+)(\d+)$/)
  if (!match) return null
  const col = columnIndex(match[1])
  const row = Number(match[2])
  if (col < 0 || !Number.isFinite(row) || row < 1) return null
  return { row, col }
}

function parseA1Range(ref: string) {
  const [startRaw, endRaw] = ref.split(':')
  const start = parseCellRef(startRaw ?? '')
  const end = parseCellRef(endRaw ?? startRaw ?? '')
  if (!start || !end) return null
  return {
    r1: Math.min(start.row, end.row),
    r2: Math.max(start.row, end.row),
    c1: Math.min(start.col, end.col),
    c2: Math.max(start.col, end.col),
  }
}

function denseRow(values: string[]) {
  const row = Array<string>(values.length)
  for (let i = 0; i < values.length; i += 1) {
    row[i] = values[i] ?? ''
  }
  return row
}

function ensureRow(rows: Map<number, string[]>, excelRow: number) {
  let row = rows.get(excelRow)
  if (!row) {
    row = []
    rows.set(excelRow, row)
  }
  return row
}

function setCell(rows: Map<number, string[]>, excelRow: number, col: number, value: string) {
  if (col < 0) return
  const row = ensureRow(rows, excelRow)
  while (row.length <= col) row.push('')
  if (!row[col]) row[col] = value
}

function getCell(rows: Map<number, string[]>, excelRow: number, col: number) {
  return rows.get(excelRow)?.[col] ?? ''
}

function parseFrozenThroughRow(xml: string) {
  const pane = xml.match(/<(?:[\w.-]+:)?pane\b([^>]*)\/?>/i)?.[1] ?? ''
  if (!/state="frozen"/i.test(pane) && !/state='frozen'/i.test(pane)) return null
  const topLeft = pane.match(/topLeftCell="([A-Z]+)(\d+)"/i)
  if (topLeft) return Number(topLeft[2]) - 1
  const ySplit = pane.match(/ySplit="([0-9]+(?:\.[0-9]+)?)"/i)
  if (!ySplit) return null
  const frozen = Number(ySplit[1])
  return Number.isFinite(frozen) && frozen >= 1 && frozen <= 80 ? Math.floor(frozen) : null
}

function applyMerges(rows: Map<number, string[]>, xml: string) {
  const refs = [
    ...xml.matchAll(/<(?:[\w.-]+:)?mergeCell\b[^>]*\bref="([^"]+)"/gi),
  ]
  for (const match of refs) {
    const range = parseA1Range(match[1] ?? '')
    if (!range) continue
    const value = getCell(rows, range.r1, range.c1).trim()
    if (!value) continue
    for (let row = range.r1; row <= range.r2; row += 1) {
      for (let col = range.c1; col <= range.c2; col += 1) {
        if (row === range.r1 && col === range.c1) continue
        setCell(rows, row, col, value)
      }
    }
  }
}

function compactSheetRows(byRow: Map<number, string[]>) {
  const excelRows = [...byRow.keys()].sort((a, b) => a - b)
  const rows = excelRows.map((excelRow) => denseRow(byRow.get(excelRow) ?? []))
  return { rows, excelRows }
}

function readCellValue(attrs: string, body: string, shared: string[]) {
  const type = attrs.match(/\bt="([^"]+)"/)?.[1] ?? ''
  if (type === 's') {
    const index = Number(xmlInner(body, 'v') ?? '')
    return shared[index] ?? ''
  }
  if (type === 'inlineStr' || type === 'str') {
    return unescapeXml(xmlInner(body, 't') ?? xmlInner(body, 'v') ?? '')
  }
  if (type === 'd') {
    return (xmlInner(body, 'v') ?? '').slice(0, 10)
  }
  const inline = xmlInner(body, 't')
  if (inline != null) return unescapeXml(inline)
  return xmlInner(body, 'v') ?? ''
}

function parseSheet(xml: string, shared: string[]) {
  if (xml.length > 2_000_000) {
    throw new Error('A planilha é grande demais para leitura segura.')
  }
  const byRow = new Map<number, string[]>()
  const rowBlocks = [
    ...xml.matchAll(
      /<(?:[\w.-]+:)?row\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?row>/gi,
    ),
  ]
  let inferredRow = 0
  for (const block of rowBlocks) {
    const attrs = block[1] ?? ''
    const inner = block[2] ?? ''
    inferredRow += 1
    const excelRow = Number(attrs.match(/\br="(\d+)"/i)?.[1] ?? inferredRow)
    const cells = [
      ...inner.matchAll(
        /<(?:[\w.-]+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:[\w.-]+:)?c>)/gi,
      ),
    ]
    for (const cell of cells) {
      const cellAttrs = cell[1] ?? ''
      const body = cell[2] ?? ''
      const ref = cellAttrs.match(/\br="([^"]+)"/i)?.[1]
      const value = readCellValue(cellAttrs, body, shared)
      if (ref) {
        const parsed = parseCellRef(ref)
        if (parsed) setCell(byRow, parsed.row, parsed.col, value)
      } else {
        const row = ensureRow(byRow, excelRow)
        row.push(value)
      }
    }
  }

  applyMerges(byRow, xml)
  const { rows, excelRows } = compactSheetRows(byRow)
  const frozenExcelRow = parseFrozenThroughRow(xml)
  const preferredHeaderIndex =
    frozenExcelRow == null
      ? -1
      : excelRows.reduce(
          (found, excelRow, index) => (excelRow <= frozenExcelRow ? index : found),
          -1,
        )
  return {
    rows,
    preferredHeaderIndex: preferredHeaderIndex >= 0 ? preferredHeaderIndex : undefined,
  }
}

export const xlsxParser: StatementParser = {
  id: 'xlsx',
  matches(file) {
    return file.format === 'xlsx'
  },
  async parse(file: DetectedFile): Promise<ParseResult> {
    try {
      const files = await unzip(file.bytes)
      if (!findFile(files, (name) => name === '[Content_Types].xml')) {
        const result = emptyResult('xlsx')
        result.warnings.push({ message: 'O arquivo ZIP não é uma planilha XLSX válida.' })
        return result
      }
      const sharedXml = findFile(files, (name) =>
        /^xl\/sharedStrings\.xml$/i.test(name),
      )
      const shared = sharedXml ? parseSharedStrings(decodeXml(sharedXml)) : []
      const sheets = worksheetEntries(files)

      if (sheets.length === 0) {
        const result = emptyResult('xlsx')
        result.warnings.push({ message: 'Planilha XLSX sem aba de dados' })
        return result
      }

      let best: ParseResult | null = null
      let sample = ''
      for (const [, sheet] of sheets) {
        const parsed = parseSheet(decodeXml(sheet), shared)
        sample += ` ${parsed.rows.slice(0, 8).flat().join(' ')}`
        const current = parseTabularRows(parsed.rows, {
          preferredHeaderIndex: parsed.preferredHeaderIndex,
        })
        current.format = 'xlsx'
        if (!best || current.movements.length > best.movements.length) {
          best = current
        }
      }

      const result = best ?? emptyResult('xlsx')
      const detected = detectBank(sample)
      result.bankCode = detected.bankCode
      result.bankName = detected.bankName
      return result
    } catch (error) {
      const result = emptyResult('xlsx')
      result.warnings.push({
        message:
          error instanceof Error
            ? `Falha ao ler XLSX: ${error.message}`
            : 'Falha ao ler XLSX',
      })
      return result
    }
  },
}
