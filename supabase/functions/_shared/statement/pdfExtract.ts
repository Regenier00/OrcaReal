import { inflateLimited } from './inflate.ts'
import {
  MAX_CSV_ROWS,
  MAX_PDF_OBJECTS,
  MAX_PDF_STREAMS,
  MAX_PDF_TEXT_RUNS,
  MAX_UNCOMPRESSED_ENTRY,
  MAX_UNCOMPRESSED_TOTAL,
} from './limits.ts'

export interface PdfExtraction {
  text: string
  rows: string[][]
  alignedRows: string[][]
  encrypted: boolean
}

type PdfRef = { t: 'ref'; n: number; g: number }
type PdfStr = { t: 'str'; b: Uint8Array }
type PdfDict = Map<string, PdfVal>
type PdfVal =
  | null
  | boolean
  | number
  | string
  | PdfRef
  | PdfStr
  | PdfVal[]
  | PdfDict
  | { t: 'stream'; dict: PdfDict; bytes: Uint8Array }

type Matrix = [number, number, number, number, number, number]

interface TextRun {
  x: number
  y: number
  text: string
  fontSize: number
}

interface CMap {
  decode(bytes: Uint8Array): string
}

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]
const IMAGE_FILTERS = new Set([
  'DCTDecode',
  'JPXDecode',
  'JBIG2Decode',
  'CCITTFaxDecode',
  'RunLengthDecode',
])

function isWs(code: number) {
  return (
    code === 0 ||
    code === 9 ||
    code === 10 ||
    code === 12 ||
    code === 13 ||
    code === 32
  )
}

function isDelim(char: string) {
  return '()<>[]{}/%'.includes(char)
}

function multiply(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ]
}

function apply(m: Matrix, x: number, y: number) {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] }
}

function latin(bytes: Uint8Array) {
  return new TextDecoder('latin1').decode(bytes)
}

function bytesFromLatin(value: string) {
  const out = new Uint8Array(value.length)
  for (let i = 0; i < value.length; i += 1) out[i] = value.charCodeAt(i)
  return out
}

function asDict(value: PdfVal | undefined): PdfDict | null {
  if (value && typeof value === 'object' && 't' in value && value.t === 'stream') {
    return value.dict
  }
  return value instanceof Map ? value : null
}

function asName(value: PdfVal | undefined): string | null {
  return typeof value === 'string' ? value : null
}

function asNum(value: PdfVal | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asRef(value: PdfVal | undefined): PdfRef | null {
  return value && typeof value === 'object' && 't' in value && value.t === 'ref'
    ? value
    : null
}

function asArray(value: PdfVal | undefined): PdfVal[] {
  return Array.isArray(value) ? value : value == null ? [] : [value]
}

function dictGet(dict: PdfDict | null, key: string): PdfVal | undefined {
  return dict?.get(key)
}

function decodeName(raw: string) {
  return raw.replace(/#([0-9A-Fa-f]{2})/g, (_, hex) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  )
}

function parseHexBytes(raw: string) {
  const hex = raw.replace(/[^0-9A-Fa-f]/g, '')
  const padded = hex.length % 2 === 1 ? `${hex}0` : hex
  const out = new Uint8Array(padded.length / 2)
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(padded.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function decodeUtf16Be(bytes: Uint8Array) {
  let offset = 0
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) offset = 2
  const chars: string[] = []
  for (let i = offset; i + 1 < bytes.length; i += 2) {
    const code = (bytes[i] << 8) | bytes[i + 1]
    if (code) chars.push(String.fromCharCode(code))
  }
  return chars.join('')
}

function decodePdfBytes(bytes: Uint8Array) {
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return decodeUtf16Be(bytes)
  }
  let nuls = 0
  for (const value of bytes) if (value === 0) nuls += 1
  if (bytes.length >= 4 && nuls >= bytes.length * 0.3) return decodeUtf16Be(bytes)
  return latin(bytes)
}

function skipEol(source: string, index: number) {
  if (source[index] === '\r' && source[index + 1] === '\n') return index + 2
  if (source[index] === '\n' || source[index] === '\r') return index + 1
  return index
}

class PdfReader {
  readonly source: string
  readonly bytes: Uint8Array
  pos = 0

  constructor(bytes: Uint8Array) {
    this.bytes = bytes
    this.source = latin(bytes)
  }

  eof() {
    return this.pos >= this.source.length
  }

  peek() {
    return this.source[this.pos]
  }

  skipWs() {
    while (!this.eof()) {
      const char = this.peek()
      if (isWs(this.source.charCodeAt(this.pos))) {
        this.pos += 1
        continue
      }
      if (char === '%') {
        while (!this.eof() && this.peek() !== '\n' && this.peek() !== '\r') {
          this.pos += 1
        }
        continue
      }
      break
    }
  }

  startsWith(value: string) {
    return this.source.startsWith(value, this.pos)
  }
}

function readLiteralString(reader: PdfReader): PdfStr {
  reader.pos += 1
  const bytes: number[] = []
  let depth = 1
  while (!reader.eof() && bytes.length < 32_000) {
    const char = reader.source[reader.pos]
    reader.pos += 1
    if (char === '(') {
      depth += 1
      bytes.push(0x28)
      continue
    }
    if (char === ')') {
      depth -= 1
      if (depth === 0) break
      bytes.push(0x29)
      continue
    }
    if (char !== '\\') {
      bytes.push(char.charCodeAt(0))
      continue
    }
    if (reader.eof()) break
    const next = reader.source[reader.pos]
    reader.pos += 1
    if (next === 'n') bytes.push(0x20)
    else if (next === 'r') bytes.push(0x20)
    else if (next === 't') bytes.push(0x20)
    else if (next === 'b') bytes.push(0x08)
    else if (next === 'f') bytes.push(0x0c)
    else if (next === '(' || next === ')' || next === '\\') {
      bytes.push(next.charCodeAt(0))
    } else if (next === '\n' || next === '\r') {
      if (next === '\r' && reader.peek() === '\n') reader.pos += 1
    } else if (next >= '0' && next <= '7') {
      let oct = next
      for (let i = 0; i < 2 && /[0-7]/.test(reader.peek() ?? ''); i += 1) {
        oct += reader.source[reader.pos]
        reader.pos += 1
      }
      bytes.push(Number.parseInt(oct, 8) & 0xff)
    }
  }
  return { t: 'str', b: Uint8Array.from(bytes) }
}

function readHexString(reader: PdfReader): PdfStr {
  reader.pos += 1
  let hex = ''
  while (!reader.eof()) {
    const char = reader.source[reader.pos]
    reader.pos += 1
    if (char === '>') break
    hex += char
    if (hex.length > 64_000) break
  }
  return { t: 'str', b: parseHexBytes(hex) }
}

function readName(reader: PdfReader) {
  reader.pos += 1
  let raw = ''
  while (!reader.eof()) {
    const code = reader.source.charCodeAt(reader.pos)
    if (isWs(code) || isDelim(reader.peek())) break
    raw += reader.source[reader.pos]
    reader.pos += 1
    if (raw.length > 200) break
  }
  return decodeName(raw)
}

function readNumberOrRef(reader: PdfReader): PdfVal {
  const start = reader.pos
  if (reader.peek() === '+' || reader.peek() === '-') reader.pos += 1
  while (/[0-9]/.test(reader.peek() ?? '')) reader.pos += 1
  if (reader.peek() === '.') {
    reader.pos += 1
    while (/[0-9]/.test(reader.peek() ?? '')) reader.pos += 1
  }
  const first = Number(reader.source.slice(start, reader.pos))
  const after = reader.pos
  reader.skipWs()
  const genStart = reader.pos
  if (/[0-9]/.test(reader.peek() ?? '')) {
    while (/[0-9]/.test(reader.peek() ?? '')) reader.pos += 1
    const genRaw = reader.source.slice(genStart, reader.pos)
    reader.skipWs()
    if (reader.peek() === 'R') {
      reader.pos += 1
      return { t: 'ref', n: Number(reader.source.slice(start, after)), g: Number(genRaw) }
    }
  }
  reader.pos = after
  return first
}

function readToken(reader: PdfReader): PdfVal | { t: 'op'; name: string } {
  reader.skipWs()
  if (reader.eof()) return { t: 'op', name: '' }
  const char = reader.peek()
  if (char === '(') return readLiteralString(reader)
  if (char === '<' && reader.source[reader.pos + 1] === '<') {
    reader.pos += 2
    const dict: PdfDict = new Map()
    while (!reader.eof()) {
      reader.skipWs()
      if (reader.startsWith('>>')) {
        reader.pos += 2
        break
      }
      if (reader.peek() !== '/') break
      const key = readName(reader)
      const value = readObject(reader)
      if (key) dict.set(key, value)
    }
    return dict
  }
  if (char === '<') return readHexString(reader)
  if (char === '/') return readName(reader)
  if (char === '[') {
    reader.pos += 1
    const items: PdfVal[] = []
    while (!reader.eof()) {
      reader.skipWs()
      if (reader.peek() === ']') {
        reader.pos += 1
        break
      }
      items.push(readObject(reader))
      if (items.length > 8_000) break
    }
    return items
  }
  if (char === '+' || char === '-' || char === '.' || (char >= '0' && char <= '9')) {
    return readNumberOrRef(reader)
  }

  let name = ''
  while (!reader.eof()) {
    const code = reader.source.charCodeAt(reader.pos)
    if (isWs(code) || isDelim(reader.peek())) break
    name += reader.source[reader.pos]
    reader.pos += 1
    if (name.length > 40) break
  }
  if (name === 'true') return true
  if (name === 'false') return false
  if (name === 'null') return null
  return { t: 'op', name }
}

function readObject(reader: PdfReader): PdfVal {
  const token = readToken(reader)
  if (token && typeof token === 'object' && 't' in token && token.t === 'op') {
    return null
  }
  return token as PdfVal
}

function filterNames(dict: PdfDict | null): string[] {
  const value = dictGet(dict, 'Filter') ?? dictGet(dict, 'F')
  if (typeof value === 'string') return [value]
  return asArray(value).filter((item): item is string => typeof item === 'string')
}

function isImageDict(dict: PdfDict | null) {
  const subtype = asName(dictGet(dict, 'Subtype'))
  const type = asName(dictGet(dict, 'Type'))
  if (subtype === 'Image' || type === 'XObject' && subtype === 'Image') return true
  return filterNames(dict).some((name) => IMAGE_FILTERS.has(name))
}

function decodeAscii85(data: Uint8Array) {
  const out: number[] = []
  let group: number[] = []
  for (let i = 0; i < data.length; i += 1) {
    const code = data[i]
    if (isWs(code)) continue
    if (code === 0x7e && data[i + 1] === 0x3e) break
    if (code === 0x7a && group.length === 0) {
      out.push(0, 0, 0, 0)
      continue
    }
    if (code < 33 || code > 117) continue
    group.push(code - 33)
    if (group.length === 5) {
      let value = 0
      for (const n of group) value = value * 85 + n
      out.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff)
      group = []
    }
  }
  if (group.length > 0) {
    const padded = group.concat(Array(5 - group.length).fill(84))
    let value = 0
    for (const n of padded) value = value * 85 + n
    const bytes = [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]
    out.push(...bytes.slice(0, group.length - 1))
  }
  return Uint8Array.from(out)
}

function decodeAsciiHex(data: Uint8Array) {
  return parseHexBytes(latin(data).split('>')[0] ?? '')
}

async function decodeFilters(data: Uint8Array, filters: string[]) {
  let current = data
  for (const filter of filters) {
    if (filter === 'FlateDecode' || filter === 'Fl') {
      try {
        current = await inflateLimited(current, 'deflate', MAX_UNCOMPRESSED_ENTRY)
      } catch {
        current = await inflateLimited(current, 'deflate-raw', MAX_UNCOMPRESSED_ENTRY)
      }
    } else if (filter === 'ASCII85Decode' || filter === 'A85') {
      current = decodeAscii85(current)
    } else if (filter === 'ASCIIHexDecode' || filter === 'AHx') {
      current = decodeAsciiHex(current)
    } else if (IMAGE_FILTERS.has(filter)) {
      throw new Error('image')
    }
  }
  return current
}

function parseCMap(text: string): CMap | null {
  if (!/beginbfchar|beginbfrange/.test(text)) return null
  const map = new Map<number, string>()
  let codeBytes = 2

  const space = text.match(/begincodespacerange\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/i)
  if (space) codeBytes = Math.max(1, Math.ceil(space[1].length / 2))

  const hexToInt = (hex: string) => Number.parseInt(hex.replace(/\s+/g, ''), 16)
  const hexToText = (hex: string) => decodeUtf16Be(parseHexBytes(hex))

  const charRe = /<([0-9A-Fa-f\s]+)>\s*<([0-9A-Fa-f\s]+)>/g
  const charBlocks = text.split(/endbfchar/i)[0]?.split(/beginbfchar/i).slice(1) ?? []
  for (const block of charBlocks) {
    charRe.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = charRe.exec(block))) {
      map.set(hexToInt(match[1]), hexToText(match[2]))
    }
  }

  const rangeBlocks = text.split(/endbfrange/i)[0]?.split(/beginbfrange/i).slice(1) ?? []
  for (const block of rangeBlocks) {
    const rangeRe =
      /<([0-9A-Fa-f\s]+)>\s*<([0-9A-Fa-f\s]+)>\s*(?:<([0-9A-Fa-f\s]+)>|\[([^\]]+)\])/g
    let match: RegExpExecArray | null
    while ((match = rangeRe.exec(block))) {
      const start = hexToInt(match[1])
      const end = hexToInt(match[2])
      if (match[4]) {
        const dests = [...match[4].matchAll(/<([0-9A-Fa-f\s]+)>/g)].map((item) =>
          hexToText(item[1]),
        )
        for (let i = 0; i <= end - start && i < dests.length; i += 1) {
          map.set(start + i, dests[i] ?? '')
        }
      } else if (match[3]) {
        const destBytes = parseHexBytes(match[3])
        for (let i = 0; i <= end - start && i < 2_000; i += 1) {
          const next = Uint8Array.from(destBytes)
          const last = next.length - 1
          if (last >= 0) next[last] = (next[last] + i) & 0xff
          map.set(start + i, decodeUtf16Be(next))
        }
      }
    }
  }

  if (map.size === 0) return null
  return {
    decode(bytes) {
      const chars: string[] = []
      for (let i = 0; i < bytes.length; ) {
        if (codeBytes === 2 && i + 1 < bytes.length) {
          const key = (bytes[i] << 8) | bytes[i + 1]
          const mapped = map.get(key)
          if (mapped != null) {
            chars.push(mapped)
            i += 2
            continue
          }
        }
        const mapped = map.get(bytes[i])
        chars.push(mapped ?? decodePdfBytes(bytes.subarray(i, i + 1)))
        i += 1
      }
      return chars.join('')
    },
  }
}

interface ParsedPdf {
  objects: Map<string, PdfVal>
  encrypted: boolean
  uncompressed: number
}

function keyOf(num: number, gen: number) {
  return `${num} ${gen}`
}

function consumeStream(reader: PdfReader, dict: PdfDict): Uint8Array {
  reader.skipWs()
  if (!reader.startsWith('stream')) return new Uint8Array()
  reader.pos += 6
  reader.pos = skipEol(reader.source, reader.pos)
  const length = asNum(dictGet(dict, 'Length'))
  if (length != null && length >= 0) {
    const end = Math.min(reader.bytes.length, reader.pos + length)
    const bytes = reader.bytes.subarray(reader.pos, end)
    reader.pos = end
    reader.skipWs()
    if (reader.startsWith('endstream')) reader.pos += 9
    return bytes
  }
  const end = reader.source.indexOf('endstream', reader.pos)
  if (end < 0) {
    const bytes = reader.bytes.subarray(reader.pos)
    reader.pos = reader.source.length
    return bytes
  }
  let bodyEnd = end
  if (reader.source[bodyEnd - 1] === '\n') bodyEnd -= 1
  if (reader.source[bodyEnd - 1] === '\r') bodyEnd -= 1
  const bytes = reader.bytes.subarray(reader.pos, bodyEnd)
  reader.pos = end + 9
  return bytes
}

async function parsePdfFile(bytes: Uint8Array): Promise<ParsedPdf> {
  const reader = new PdfReader(bytes)
  const objects = new Map<string, PdfVal>()
  let encrypted = /\/Encrypt[\s/]/.test(reader.source.slice(-8_000))
  let uncompressed = 0
  let streams = 0

  const objRe = /(\d+)\s+(\d+)\s+obj\b/g
  let match: RegExpExecArray | null
  while ((match = objRe.exec(reader.source))) {
    if (objects.size >= MAX_PDF_OBJECTS) break
    reader.pos = match.index + match[0].length
    const num = Number(match[1])
    const gen = Number(match[2])
    let value: PdfVal
    try {
      value = readObject(reader)
    } catch {
      objRe.lastIndex = reader.pos
      continue
    }
    const dict = asDict(value)
    reader.skipWs()
    if (dict && reader.startsWith('stream')) {
      if (streams >= MAX_PDF_STREAMS) {
        objRe.lastIndex = reader.pos
        continue
      }
      streams += 1
      const raw = consumeStream(reader, dict)
      if (isImageDict(dict)) {
        const filters = filterNames(dict)
        const jpeg = filters.includes('DCTDecode') || filters.includes('DCT')
        const keep =
          jpeg &&
          raw.byteLength > 200 &&
          uncompressed + raw.byteLength <= MAX_UNCOMPRESSED_TOTAL
            ? raw
            : new Uint8Array()
        if (keep.byteLength) uncompressed += keep.byteLength
        objects.set(keyOf(num, gen), { t: 'stream', dict, bytes: keep })
        objRe.lastIndex = reader.pos
        continue
      }
      let decoded = raw
      try {
        decoded = await decodeFilters(raw, filterNames(dict))
      } catch {
        decoded = raw.slice(0, 4_000)
      }
      uncompressed += decoded.byteLength
      if (uncompressed > MAX_UNCOMPRESSED_TOTAL) decoded = decoded.slice(0, 0)
      objects.set(keyOf(num, gen), { t: 'stream', dict, bytes: decoded })
    } else {
      objects.set(keyOf(num, gen), value)
    }
    reader.skipWs()
    if (reader.startsWith('endobj')) reader.pos += 6
    objRe.lastIndex = reader.pos
  }

  return { objects, encrypted, uncompressed }
}

function resolve(parsed: ParsedPdf, value: PdfVal | undefined, depth = 0): PdfVal | undefined {
  if (!value || depth > 20) return value
  const ref = asRef(value)
  if (!ref) return value
  return resolve(parsed, parsed.objects.get(keyOf(ref.n, ref.g)), depth + 1)
}

function resolveDict(parsed: ParsedPdf, value: PdfVal | undefined): PdfDict | null {
  return asDict(resolve(parsed, value))
}

function streamBytes(value: PdfVal | undefined) {
  if (value && typeof value === 'object' && 't' in value && value.t === 'stream') {
    return value.bytes
  }
  return new Uint8Array()
}

function pageKids(parsed: ParsedPdf, node: PdfVal | undefined, acc: PdfDict[], seen: Set<string>) {
  const resolved = resolve(parsed, node)
  const dict = asDict(resolved)
  if (!dict) return
  const type = asName(dictGet(dict, 'Type'))
  const ref = asRef(node)
  const seenKey = ref ? keyOf(ref.n, ref.g) : `${type}:${acc.length}`
  if (seen.has(seenKey)) return
  seen.add(seenKey)
  if (type === 'Page') {
    acc.push(dict)
    return
  }
  for (const kid of asArray(dictGet(dict, 'Kids'))) {
    if (acc.length > 80) break
    pageKids(parsed, kid, acc, seen)
  }
}

function inherited(parsed: ParsedPdf, page: PdfDict, key: string, depth = 0): PdfVal | undefined {
  if (depth > 12) return undefined
  const own = dictGet(page, key)
  if (own != null) return resolve(parsed, own)
  const parent = resolveDict(parsed, dictGet(page, 'Parent'))
  return parent ? inherited(parsed, parent, key, depth + 1) : undefined
}

function contentBytes(parsed: ParsedPdf, page: PdfDict) {
  const chunks: Uint8Array[] = []
  for (const item of asArray(dictGet(page, 'Contents'))) {
    const resolved = resolve(parsed, item)
    const bytes = streamBytes(resolved)
    if (bytes.byteLength) chunks.push(bytes)
  }
  if (chunks.length === 0) return new Uint8Array()
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

function fontCMap(
  parsed: ParsedPdf,
  font: PdfVal | undefined,
  cache: Map<PdfVal, CMap | null>,
): CMap | null {
  const resolved = resolve(parsed, font)
  if (!resolved) return null
  if (cache.has(resolved)) return cache.get(resolved) ?? null
  cache.set(resolved, null)
  const dict = asDict(resolved)
  if (!dict) return null
  const toUnicode = resolve(parsed, dictGet(dict, 'ToUnicode'))
  const cmap = parseCMap(latin(streamBytes(toUnicode)))
  cache.set(resolved, cmap)
  return cmap
}

function fontMap(parsed: ParsedPdf, resources: PdfDict | null) {
  const fonts = resolveDict(parsed, dictGet(resources, 'Font'))
  const map = new Map<string, PdfVal>()
  if (!fonts) return map
  for (const [name, value] of fonts) map.set(name, value)
  return map
}

function xObjectMap(parsed: ParsedPdf, resources: PdfDict | null) {
  const dict = resolveDict(parsed, dictGet(resources, 'XObject'))
  const map = new Map<string, PdfVal>()
  if (!dict) return map
  for (const [name, value] of dict) map.set(name, value)
  return map
}

function decodeString(value: PdfStr, cmap: CMap | null) {
  return cmap ? cmap.decode(value.b) : decodePdfBytes(value.b)
}

function isStr(value: PdfVal | undefined): value is PdfStr {
  return Boolean(value && typeof value === 'object' && 't' in value && value.t === 'str')
}

function skipInlineImage(reader: PdfReader) {
  const id = reader.source.indexOf('ID', reader.pos)
  if (id < 0) return
  let i = skipEol(reader.source, id + 2)
  while (i < reader.source.length - 2) {
    if (
      reader.source.startsWith('EI', i) &&
      (i === 0 || isWs(reader.source.charCodeAt(i - 1)))
    ) {
      reader.pos = i + 2
      return
    }
    i += 1
  }
}

function extractRunsFromContent(
  content: Uint8Array,
  fonts: Map<string, PdfVal>,
  parsed: ParsedPdf,
  cmapCache: Map<PdfVal, CMap | null>,
  resources: PdfDict | null = null,
  depth = 0,
  initialCtm: Matrix = IDENTITY,
): TextRun[] {
  const reader = new PdfReader(content)
  const runs: TextRun[] = []
  const stack: Matrix[] = []
  let ctm: Matrix = initialCtm
  let textMatrix: Matrix = IDENTITY
  let lineMatrix: Matrix = IDENTITY
  let fontSize = 12
  let horizontalScale = 1
  let leading = 0
  let cmap: CMap | null = null
  const args: PdfVal[] = []
  const xobjects = xObjectMap(parsed, resources)

  const emit = (str: PdfStr) => {
    if (runs.length >= MAX_PDF_TEXT_RUNS) return
    const text = decodeString(str, cmap).replace(/\s+/g, ' ')
    if (!text) return
    const combined = multiply(ctm, textMatrix)
    const point = apply(combined, 0, 0)
    const size = Math.max(1, fontSize * Math.hypot(combined[0], combined[1]))
    runs.push({ x: point.x, y: point.y, text, fontSize: size })
  }

  const shift = (tx: number, ty: number) => {
    lineMatrix = multiply(lineMatrix, [1, 0, 0, 1, tx, ty])
    textMatrix = lineMatrix
  }

  while (!reader.eof() && runs.length < MAX_PDF_TEXT_RUNS) {
    reader.skipWs()
    if (reader.eof()) break
    if (reader.startsWith('BI') && (reader.pos === 0 || isWs(content[reader.pos - 1] ?? 32))) {
      reader.pos += 2
      skipInlineImage(reader)
      args.length = 0
      continue
    }
    const token = readToken(reader)
    if (token && typeof token === 'object' && 't' in token && token.t === 'op') {
      const op = token.name
      const n = args.length
      if (op === 'q') stack.push(ctm)
      else if (op === 'Q') ctm = stack.pop() ?? IDENTITY
      else if (op === 'cm' && n >= 6) {
        const m = args.slice(-6).map((item) => asNum(item) ?? 0) as Matrix
        ctm = multiply(ctm, m)
      } else if (op === 'BT') {
        textMatrix = IDENTITY
        lineMatrix = IDENTITY
      } else if (op === 'ET') {
        textMatrix = IDENTITY
        lineMatrix = IDENTITY
      } else if (op === 'Tf' && n >= 2) {
        const name = asName(args[n - 2])
        fontSize = Math.abs(asNum(args[n - 1]) ?? fontSize)
        cmap = name ? fontCMap(parsed, fonts.get(name), cmapCache) : cmap
      } else if (op === 'Tz') horizontalScale = (asNum(args[n - 1]) ?? 100) / 100
      else if (op === 'TL') leading = asNum(args[n - 1]) ?? leading
      else if (op === 'Tm' && n >= 6) {
        textMatrix = args.slice(-6).map((item) => asNum(item) ?? 0) as Matrix
        lineMatrix = textMatrix
      } else if (op === 'Td' && n >= 2) shift(asNum(args[n - 2]) ?? 0, asNum(args[n - 1]) ?? 0)
      else if (op === 'TD' && n >= 2) {
        const tx = asNum(args[n - 2]) ?? 0
        const ty = asNum(args[n - 1]) ?? 0
        leading = -ty
        shift(tx, ty)
      } else if (op === 'T*') shift(0, -leading)
      else if (op === 'Tj' || op === "'" || op === '"') {
        if (op === "'" || op === '"') shift(0, -leading)
        const str = args[n - 1]
        if (isStr(str)) emit(str)
      } else if (op === 'TJ') {
        const items = args[n - 1]
        if (Array.isArray(items)) {
          for (const item of items) {
            if (isStr(item)) emit(item)
            else if (typeof item === 'number') {
              textMatrix = multiply(textMatrix, [
                1,
                0,
                0,
                1,
                (-item / 1000) * fontSize * horizontalScale,
                0,
              ])
            }
          }
        }
      } else if (op === 'Do' && n >= 1 && depth < 4) {
        const name = asName(args[n - 1])
        const form = name ? resolve(parsed, xobjects.get(name)) : undefined
        const dict = asDict(form)
        if (dict && asName(dictGet(dict, 'Subtype')) === 'Form') {
          const formBytes = streamBytes(form)
          if (formBytes.byteLength) {
            const formResources =
              resolveDict(parsed, dictGet(dict, 'Resources')) ?? resources
            const formFonts = fontMap(parsed, formResources)
            const matrixVal = asArray(dictGet(dict, 'Matrix')).map(
              (item) => asNum(item) ?? 0,
            )
            const formMatrix: Matrix =
              matrixVal.length >= 6 ? (matrixVal.slice(0, 6) as Matrix) : IDENTITY
            runs.push(
              ...extractRunsFromContent(
                formBytes,
                formFonts,
                parsed,
                cmapCache,
                formResources,
                depth + 1,
                multiply(ctm, formMatrix),
              ),
            )
          }
        }
      }
      args.length = 0
    } else {
      args.push(token as PdfVal)
      if (args.length > 32) args.shift()
    }
  }

  return runs
}

function clusterRows(runs: TextRun[]): TextRun[][] {
  if (runs.length === 0) return []
  const sorted = [...runs].sort((a, b) => b.y - a.y || a.x - b.x)
  const rows: TextRun[][] = []
  let current: TextRun[] = [sorted[0]]
  for (let i = 1; i < sorted.length; i += 1) {
    const run = sorted[i]
    const probe = current[0]
    const tol = Math.max(2.5, Math.min(probe.fontSize, run.fontSize) * 0.45)
    if (Math.abs(run.y - probe.y) <= tol) current.push(run)
    else {
      rows.push(current)
      current = [run]
      if (rows.length >= MAX_CSV_ROWS) break
    }
  }
  rows.push(current)
  return rows
}

function mergeRowText(row: TextRun[]) {
  const ordered = [...row].sort((a, b) => a.x - b.x)
  const cells: string[] = []
  let current = ordered[0]?.text ?? ''
  let last = ordered[0]
  for (let i = 1; i < ordered.length; i += 1) {
    const run = ordered[i]
    const gap = run.x - last.x
    const sameWord = gap <= Math.max(1.8, last.fontSize * 0.9)
    const sameCell = gap <= Math.max(16, last.fontSize * 2.2)
    if (sameWord) current += run.text
    else if (sameCell) current += ` ${run.text}`
    else {
      cells.push(current.trim())
      current = run.text
    }
    last = run
  }
  if (current.trim()) cells.push(current.trim())
  return cells
}

function alignColumns(rows: string[][], runRows: TextRun[][]) {
  const xs: number[] = []
  for (let i = 0; i < runRows.length; i += 1) {
    const ordered = [...runRows[i]].sort((a, b) => a.x - b.x)
    const cells = rows[i] ?? []
    if (cells.length <= 1) continue
    let currentX = ordered[0]?.x ?? 0
    let last = ordered[0]
    for (let j = 1; j <= ordered.length; j += 1) {
      const run = ordered[j]
      const gap = run ? run.x - (last?.x ?? 0) : Infinity
      const sameCell = run && gap <= Math.max(16, (last?.fontSize ?? 12) * 2.2)
      if (!sameCell) {
        xs.push(currentX)
        currentX = run?.x ?? currentX
      }
      last = run ?? last
    }
  }
  if (xs.length < 4) return rows

  xs.sort((a, b) => a - b)
  const means: number[] = []
  for (const x of xs) {
    const prev = means[means.length - 1]
    if (prev == null || x - prev > 18) means.push(x)
    else means[means.length - 1] = (prev + x) / 2
  }
  if (means.length < 2) return rows

  const grid: string[][] = []
  for (let i = 0; i < runRows.length; i += 1) {
    const ordered = [...runRows[i]].sort((a, b) => a.x - b.x)
    const line = Array(means.length).fill('')
    const cells = mergeRowText(ordered)
    if (cells.length <= 1) {
      grid.push(cells)
      continue
    }
    let cell = cells[0] ?? ''
    let cellX = ordered[0]?.x ?? 0
    let cellIdx = 0
    let last = ordered[0]
    const flush = (x: number, text: string) => {
      let best = 0
      let bestDist = Infinity
      for (let col = 0; col < means.length; col += 1) {
        const dist = Math.abs(means[col] - x)
        if (dist < bestDist) {
          best = col
          bestDist = dist
        }
      }
      line[best] = [line[best], text].filter(Boolean).join(' ')
    }
    for (let j = 1; j <= ordered.length; j += 1) {
      const run = ordered[j]
      const gap = run ? run.x - (last?.x ?? 0) : Infinity
      const sameCell = run && gap <= Math.max(16, (last?.fontSize ?? 12) * 2.2)
      if (sameCell) {
        last = run
        continue
      }
      flush(cellX, cell)
      cellIdx += 1
      cell = cells[cellIdx] ?? ''
      cellX = run?.x ?? cellX
      last = run ?? last
    }
    grid.push(line.map((item) => String(item).trim()))
  }
  return grid
}

function collectFallbackCmaps(parsed: ParsedPdf) {
  const cmaps: CMap[] = []
  for (const value of parsed.objects.values()) {
    const cmap = parseCMap(latin(streamBytes(value)))
    if (cmap) cmaps.push(cmap)
    if (cmaps.length >= 12) break
  }
  return cmaps
}

function looksLikeContent(bytes: Uint8Array) {
  const sample = latin(bytes.subarray(0, 8_000))
  return /\bBT\b|\bTj\b|\bTJ\b/.test(sample)
}

async function expandObjStreams(parsed: ParsedPdf) {
  for (const value of [...parsed.objects.values()]) {
    const dict = asDict(value)
    if (!dict || asName(dictGet(dict, 'Type')) !== 'ObjStm') continue
    const bytes = streamBytes(value)
    if (!bytes.byteLength) continue
    const count = asNum(dictGet(dict, 'N')) ?? 0
    const first = asNum(dictGet(dict, 'First')) ?? 0
    const header = latin(bytes.subarray(0, Math.min(bytes.length, first)))
    const nums = header.match(/\d+/g)?.map(Number) ?? []
    const reader = new PdfReader(bytes)
    for (let i = 0; i < count && i * 2 < nums.length; i += 1) {
      const objNum = nums[i * 2]
      const offset = nums[i * 2 + 1]
      if (objNum == null || offset == null) continue
      reader.pos = first + offset
      try {
        parsed.objects.set(keyOf(objNum, 0), readObject(reader))
      } catch {
        continue
      }
    }
  }
}

function findCatalog(parsed: ParsedPdf) {
  for (const value of parsed.objects.values()) {
    const dict = asDict(value)
    if (asName(dictGet(dict, 'Type')) === 'Catalog') return dict
  }
  return null
}

export async function extractPdfLayout(bytes: Uint8Array): Promise<PdfExtraction> {
  const parsed = await parsePdfFile(bytes)
  await expandObjStreams(parsed)
  const catalog = findCatalog(parsed)
  if (catalog && dictGet(catalog, 'Encrypt')) parsed.encrypted = true

  const pages: PdfDict[] = []
  if (catalog) pageKids(parsed, dictGet(catalog, 'Pages'), pages, new Set())
  if (pages.length === 0) {
    for (const value of parsed.objects.values()) {
      const dict = asDict(value)
      if (dict && asName(dictGet(dict, 'Type')) === 'Page') pages.push(dict)
    }
  }

  const cmapCache = new Map<PdfVal, CMap | null>()
  const runs: TextRun[] = []
  const fallbackCmaps = collectFallbackCmaps(parsed)

  if (pages.length > 0) {
    for (const page of pages) {
      const resources = asDict(inherited(parsed, page, 'Resources')) ?? null
      const fonts = fontMap(parsed, resources)
      const content = contentBytes(parsed, page)
      if (!content.byteLength) continue
      runs.push(
        ...extractRunsFromContent(content, fonts, parsed, cmapCache, resources),
      )
    }
  }

  if (runs.length === 0) {
    const fonts = new Map<string, PdfVal>()
    for (const value of parsed.objects.values()) {
      if (!looksLikeContent(streamBytes(value))) continue
      const extra = extractRunsFromContent(streamBytes(value), fonts, parsed, cmapCache)
      if (extra.some((run) => /[A-Za-zÀ-ÿ]/.test(run.text))) {
        runs.push(...extra)
      } else if (fallbackCmaps[0]) {
        const decoded = fallbackCmaps[0].decode(streamBytes(value))
        if (decoded.trim()) {
          runs.push({ x: 0, y: 0, text: decoded, fontSize: 12 })
        }
      }
    }
  }

  const runRows = clusterRows(runs)
  const looseRows = runRows.map(mergeRowText)
  const alignedRows = alignColumns(looseRows, runRows)
  const text = looseRows
    .map((row) => row.join(' '))
    .join('\n')
    .trim()

  return { text, rows: looseRows, alignedRows, encrypted: parsed.encrypted }
}

export async function extractPdfJpegImages(bytes: Uint8Array): Promise<Uint8Array[]> {
  const parsed = await parsePdfFile(bytes)
  const images: Uint8Array[] = []
  for (const value of parsed.objects.values()) {
    const data = streamBytes(value)
    if (data.byteLength < 200) continue
    if (data[0] !== 0xff || data[1] !== 0xd8) continue
    images.push(data)
    if (images.length >= 40) break
  }
  return images
}
