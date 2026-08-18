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

function denseRow(values: string[]) {
  const row = Array<string>(values.length)
  for (let i = 0; i < values.length; i += 1) {
    row[i] = values[i] ?? ''
  }
  return row
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
  const rows: string[][] = []
  const rowBlocks = [
    ...xml.matchAll(
      /<(?:[\w.-]+:)?row\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?row>/gi,
    ),
  ]
  for (const block of rowBlocks) {
    const inner = block[2] ?? ''
    const cells = [
      ...inner.matchAll(
        /<(?:[\w.-]+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:[\w.-]+:)?c>)/gi,
      ),
    ]
    const values: string[] = []
    for (const cell of cells) {
      const attrs = cell[1] ?? ''
      const body = cell[2] ?? ''
      const ref = attrs.match(/\br="([^"]+)"/i)?.[1]
      const value = readCellValue(attrs, body, shared)
      if (ref) {
        const index = columnIndex(ref)
        if (index >= 0) values[index] = value
      } else {
        values.push(value)
      }
    }
    rows.push(denseRow(values))
  }
  return rows
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
        const rows = parseSheet(decodeXml(sheet), shared)
        sample += ` ${rows.slice(0, 8).flat().join(' ')}`
        const current = parseTabularRows(rows)
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
