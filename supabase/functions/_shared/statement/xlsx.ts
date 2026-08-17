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

function isNeededXlsxEntry(name: string) {
  return (
    name === '[Content_Types].xml' ||
    name === 'xl/sharedStrings.xml' ||
    /^xl\/worksheets\/sheet\d+\.xml$/.test(name)
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
    files.set(name, content)
  }

  return files
}

function decodeXml(bytes: Uint8Array) {
  return new TextDecoder('utf-8').decode(bytes)
}

function unescapeXml(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function parseSharedStrings(xml: string) {
  if (xml.length > 2_000_000) {
    throw new Error('A planilha é grande demais para leitura segura.')
  }
  const values: string[] = []
  const items = xml.match(/<si[\s\S]*?<\/si>/g) ?? []
  for (const item of items) {
    const texts = [...item.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((match) =>
      unescapeXml(match[1]),
    )
    values.push(texts.join(''))
  }
  return values
}

function columnIndex(ref: string) {
  const letters = ref.replace(/\d+/g, '')
  let index = 0
  for (const char of letters) {
    index = index * 26 + (char.charCodeAt(0) - 64)
  }
  return index - 1
}

function parseSheet(xml: string, shared: string[]) {
  if (xml.length > 2_000_000) {
    throw new Error('A planilha é grande demais para leitura segura.')
  }
  const rows: string[][] = []
  const rowBlocks = xml.match(/<row[^>]*>[\s\S]*?<\/row>/g) ?? []
  for (const block of rowBlocks) {
    const cells = [...block.matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)]
    const values: string[] = []
    for (const cell of cells) {
      const attrs = cell[1]
      const body = cell[2]
      const ref = attrs.match(/\br="([A-Z]+\d+)"/i)?.[1]
      const type = attrs.match(/\bt="([^"]+)"/)?.[1]
      let value = ''
      if (type === 's') {
        const index = Number(body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '')
        value = shared[index] ?? ''
      } else if (type === 'inlineStr' || type === 'str') {
        value = unescapeXml(body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '')
      } else if (type === 'd') {
        const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? ''
        value = raw.slice(0, 10)
      } else {
        value = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? ''
      }
      if (ref) values[columnIndex(ref)] = value
      else values.push(value)
    }
    rows.push(values.map((item) => item ?? ''))
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
      if (!files.has('[Content_Types].xml')) {
        const result = emptyResult('xlsx')
        result.warnings.push({ message: 'O arquivo ZIP não é uma planilha XLSX válida.' })
        return result
      }
      const sharedXml = files.get('xl/sharedStrings.xml')
      const shared = sharedXml ? parseSharedStrings(decodeXml(sharedXml)) : []
      const sheet =
        files.get('xl/worksheets/sheet1.xml') ??
        [...files.entries()].find(([name]) =>
          name.startsWith('xl/worksheets/sheet'),
        )?.[1]

      if (!sheet) {
        const result = emptyResult('xlsx')
        result.warnings.push({ message: 'Planilha XLSX sem aba de dados' })
        return result
      }

      const rows = parseSheet(decodeXml(sheet), shared)
      const result = parseTabularRows(rows)
      result.format = 'xlsx'
      const sample = rows
        .slice(0, 8)
        .flat()
        .join(' ')
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
