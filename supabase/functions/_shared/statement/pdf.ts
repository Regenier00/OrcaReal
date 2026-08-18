import { detectBank } from './banks.ts'
import { inflateLimited } from './inflate.ts'
import { MAX_PDF_STREAMS, MAX_UNCOMPRESSED_ENTRY } from './limits.ts'
import {
  capWarnings,
  emptyResult,
  finalizeMovements,
  parseAmount,
  parseBrazilianDate,
  typeFromSignedAmount,
} from './normalize.ts'
import type {
  DetectedFile,
  ParseResult,
  RawMovement,
  StatementParser,
} from './types.ts'

async function inflatePdfStream(data: Uint8Array) {
  try {
    return await inflateLimited(data, 'deflate', MAX_UNCOMPRESSED_ENTRY)
  } catch {
    return inflateLimited(data, 'deflate-raw', MAX_UNCOMPRESSED_ENTRY)
  }
}

function decodePdfString(value: string) {
  return value
    .replace(/\\n/g, ' ')
    .replace(/\\r/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\(\d{1,3})/g, (_, oct) =>
      String.fromCharCode(Number.parseInt(oct, 8)),
    )
}

function extractLiteralStrings(content: string) {
  const texts: string[] = []
  const re = /\((?:\\.|[^\\)]){0,400}\)/g
  let match: RegExpExecArray | null
  let count = 0
  while ((match = re.exec(content))) {
    texts.push(decodePdfString(match[0].slice(1, -1)))
    count += 1
    if (count > 20_000) break
  }
  return texts
}

async function extractPdfText(bytes: Uint8Array) {
  const latin = new TextDecoder('latin1').decode(bytes)
  const texts: string[] = []
  const marker = 'stream'
  let cursor = 0
  let streams = 0

  while (streams < MAX_PDF_STREAMS) {
    const start = latin.indexOf(marker, cursor)
    if (start < 0) break
    const dataStart = start + marker.length
    const after = latin.slice(dataStart, dataStart + 2)
    const bodyStart =
      after === '\r\n' ? dataStart + 2 : after.startsWith('\n') ? dataStart + 1 : dataStart
    const end = latin.indexOf('endstream', bodyStart)
    if (end < 0) break
    const raw = latin.slice(bodyStart, end)
    cursor = end + 9
    streams += 1
    if (raw.length > MAX_UNCOMPRESSED_ENTRY) continue

    const binary = Uint8Array.from(raw, (char) => char.charCodeAt(0))
    let decoded = raw
    try {
      decoded = new TextDecoder('latin1').decode(await inflatePdfStream(binary))
    } catch {
      decoded = raw.slice(0, 50_000)
    }
    texts.push(...extractLiteralStrings(decoded))
  }

  if (texts.length === 0) {
    texts.push(...extractLiteralStrings(latin.slice(0, 200_000)))
  }

  return texts.join(' ')
}

function linesFromText(text: string) {
  return text
    .replace(/\s{2,}/g, ' ')
    .split(/(?=\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12_000)
}

export const pdfParser: StatementParser = {
  id: 'pdf',
  matches(file) {
    return file.format === 'pdf'
  },
  async parse(file: DetectedFile): Promise<ParseResult> {
    const result = emptyResult('pdf')
    const text = await extractPdfText(file.bytes)
    const detected = detectBank(text.slice(0, 4000))
    result.bankCode = detected.bankCode
    result.bankName = detected.bankName

    const printable = text.replace(/[^\S\n]+/g, ' ').trim()
    if (printable.length < 40) {
      result.ocrRequired = true
      result.warnings.push({
        message:
          'PDF sem texto extraível. OCR será suportado em breve para extratos digitalizados.',
      })
      return result
    }

    const movements: RawMovement[] = []
    for (const line of linesFromText(printable)) {
      const dateMatch = line.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/)
      if (!dateMatch) continue
      const posted = parseBrazilianDate(dateMatch[1])
      if (!posted) continue

      const amountMatches = [
        ...line.matchAll(/-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+[.,]\d{2}/g),
      ]
      if (amountMatches.length === 0) continue
      const signed = parseAmount(amountMatches[amountMatches.length - 1][0])
      if (signed == null || signed === 0) continue

      const description = line
        .replace(dateMatch[0], '')
        .replace(amountMatches[amountMatches.length - 1][0], '')
        .replace(/saldo.*/i, '')
        .trim()

      if (!description) continue

      movements.push({
        postedAt: posted,
        description,
        amount: Math.abs(signed),
        type: typeFromSignedAmount(signed),
        balance: null,
        externalId: null,
        documentNumber: null,
        counterparty: null,
        raw: { source: 'pdf' },
      })
    }

    result.movements = finalizeMovements(movements)
    result.warnings = capWarnings(result.warnings)
    if (result.movements.length === 0) {
      result.warnings.push({
        message:
          'Não foi possível ler lançamentos tabulares neste PDF. Envie OFX, CSV ou XLSX, ou um PDF estruturado.',
      })
    }
    return result
  },
}

export const ocrParser: StatementParser = {
  id: 'ocr',
  matches() {
    return false
  },
  parse(): ParseResult {
    const result = emptyResult('pdf')
    result.ocrRequired = true
    result.warnings.push({
      message: 'Parser OCR reservado para extratos digitalizados.',
    })
    return result
  },
}
