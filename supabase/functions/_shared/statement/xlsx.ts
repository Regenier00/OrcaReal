import { parseTabularRows } from './csv.ts'
import { detectBank } from './banks.ts'
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
  const stream = new Blob([data]).stream().pipeThrough(
    new DecompressionStream('deflate-raw'),
  )
  const buffer = await new Response(stream).arrayBuffer()
  return new Uint8Array(buffer)
}

async function unzip(bytes: Uint8Array) {
  const files = new Map<string, Uint8Array>()
  let offset = bytes.length - 22
  while (offset >= 0 && readU32(bytes, offset) !== 0x06054b50) {
    offset -= 1
  }
  if (offset < 0) throw new Error('Arquivo XLSX inválido')

  const cdOffset = readU32(bytes, offset + 16)
  const cdEntries = readU16(bytes, offset + 10)
  let cursor = cdOffset

  for (let i = 0; i < cdEntries; i += 1) {
    if (readU32(bytes, cursor) !== 0x02014b50) break
    const method = readU16(bytes, cursor + 10)
    const compressedSize = readU32(bytes, cursor + 20)
    const nameLength = readU16(bytes, cursor + 28)
    const extraLength = readU16(bytes, cursor + 30)
    const commentLength = readU16(bytes, cursor + 32)
    const localOffset = readU32(bytes, cursor + 42)
    const name = new TextDecoder().decode(
      bytes.slice(cursor + 46, cursor + 46 + nameLength),
    )
    const localNameLength = readU16(bytes, localOffset + 26)
    const localExtraLength = readU16(bytes, localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const compressed = bytes.slice(dataStart, dataStart + compressedSize)
    const content = method === 0 ? compressed : await inflateRaw(compressed)
    files.set(name, content)
    cursor += 46 + nameLength + extraLength + commentLength
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

function excelSerialToIso(serial: number) {
  const epoch = Date.UTC(1899, 11, 30)
  return new Date(epoch + Math.round(serial) * 86400000).toISOString().slice(0, 10)
}

function parseSheet(xml: string, shared: string[]) {
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
      } else if (type === 'inlineStr') {
        value = unescapeXml(body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? '')
      } else {
        const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? ''
        const numeric = Number(raw)
        if (raw && Number.isFinite(numeric) && numeric > 20000 && numeric < 80000) {
          value = excelSerialToIso(numeric)
        } else {
          value = raw
        }
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
