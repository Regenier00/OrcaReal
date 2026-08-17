import { detectBank } from './banks.ts'
import {
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

async function inflate(data: Uint8Array) {
  try {
    const stream = new Blob([data]).stream().pipeThrough(
      new DecompressionStream('deflate'),
    )
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    const stream = new Blob([data]).stream().pipeThrough(
      new DecompressionStream('deflate-raw'),
    )
    return new Uint8Array(await new Response(stream).arrayBuffer())
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
  const re = /\((?:\\.|[^\\)])*\)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(content))) {
    texts.push(decodePdfString(match[0].slice(1, -1)))
  }
  return texts
}

async function extractPdfText(bytes: Uint8Array) {
  const latin = new TextDecoder('latin1').decode(bytes)
  const texts: string[] = []
  const streamRe = /stream\r?\n([\s\S]*?)endstream/g
  let match: RegExpExecArray | null
  while ((match = streamRe.exec(latin))) {
    const raw = match[1]
    const binary = Uint8Array.from(raw, (char) => char.charCodeAt(0))
    let decoded = raw
    try {
      decoded = new TextDecoder('latin1').decode(await inflate(binary))
    } catch {
      decoded = raw
    }
    texts.push(...extractLiteralStrings(decoded))
  }

  if (texts.length === 0) {
    texts.push(...extractLiteralStrings(latin))
  }

  return texts.join(' ')
}

function linesFromText(text: string) {
  return text
    .replace(/\s{2,}/g, ' ')
    .split(/(?=\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/)
    .map((line) => line.trim())
    .filter(Boolean)
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
        type: typeFromSignedAmount(signed, description),
        balance: null,
        externalId: null,
        documentNumber: null,
        counterparty: null,
        raw: { line },
      })
    }

    result.movements = finalizeMovements(movements)
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
