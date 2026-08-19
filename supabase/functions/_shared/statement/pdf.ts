import { parseTabularRows } from './csv.ts'
import { detectBank } from './banks.ts'
import {
  capWarnings,
  emptyResult,
  finalizeMovements,
  parseAmount,
  parseBrazilianDate,
  typeFromLabel,
  typeFromSignedAmount,
} from './normalize.ts'
import { extractPdfLayout } from './pdfExtract.ts'
import type {
  DetectedFile,
  ParseResult,
  RawMovement,
  StatementParser,
} from './types.ts'

const DATE_PATTERN =
  '\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4}|\\d{1,2}[./\\-\\s]+[A-Za-zÀ-ÿ]{3,9}\\.?[./\\-\\s]+\\d{2,4}'
const DATE_RE = new RegExp(`(${DATE_PATTERN})`)
const DATE_SPLIT_RE = new RegExp(`(?=${DATE_PATTERN})`)
const AMOUNT_PATTERN =
  '(?:R\\$\\s*)?-?\\d{1,3}(?:\\.\\d{3})*,\\d{2}-?|(?:R\\$\\s*)?-?\\d+[.,]\\d{2}-?|\\(\\d{1,3}(?:\\.\\d{3})*,\\d{2}\\)|\\d{1,3}(?:\\.\\d{3})*,\\d{2}\\s*[DdCc]'

function amountRegex() {
  return new RegExp(AMOUNT_PATTERN, 'g')
}
const SKIP_LINE =
  /saldo\s*(anterior|inicial|final|atual)|opening balance|closing balance|^totais?$|^subtotal$/i

function looksExtractable(text: string) {
  const compact = text.replace(/\s+/g, '')
  if (compact.length >= 40) return true
  if (DATE_RE.test(text) && amountRegex().test(text)) return true
  return /[A-Za-zÀ-ÿ]{6,}/.test(compact) && compact.length >= 24
}

function collapseSpacedGlyphs(text: string) {
  const tokens = text.split(/\s+/).filter(Boolean)
  if (tokens.length < 16) return text
  const singles = tokens.filter((token) => token.length === 1).length
  if (singles < tokens.length * 0.55) return text
  return tokens.join('')
}

function linesFromText(text: string) {
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(DATE_SPLIT_RE))
    .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 12_000)
}

function pickAmount(line: string) {
  const matches = [...line.matchAll(amountRegex())]
  if (matches.length === 0) return null
  const chosen =
    matches.length >= 2 ? matches[matches.length - 2][0] : matches[matches.length - 1][0]
  const signed = parseAmount(chosen)
  if (signed == null || signed === 0) return null
  const after = line.slice((matches.length >= 2 ? matches[matches.length - 2] : matches[0]).index ?? 0)
  const suffix = after.match(/^\s*(?:R\$\s*)?[^\s]*\s*([DdCc])\b/)
  const labeled = suffix ? typeFromLabel(suffix[1]) : typeFromLabel(chosen)
  return { raw: chosen, signed, labeled }
}

function movementFromLine(line: string): RawMovement | null {
  const dateMatch = line.match(DATE_RE)
  if (!dateMatch) return null
  const posted = parseBrazilianDate(dateMatch[1])
  if (!posted) return null

  const amount = pickAmount(line)
  if (!amount) return null

  let type = amount.labeled ?? 'unknown'
  let signed = amount.signed
  if (type === 'expense' && signed > 0) signed = -signed
  if (type === 'income' && signed < 0) signed = Math.abs(signed)
  if (type === 'unknown') type = typeFromSignedAmount(signed)

  const description = line
    .replace(dateMatch[0], ' ')
    .replace(amount.raw, ' ')
    .replace(amountRegex(), ' ')
    .replace(/saldo.*/i, ' ')
    .replace(/\b[DdCc]\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!description || !/[a-zA-ZÀ-ÿ]/.test(description)) return null
  if (SKIP_LINE.test(description)) return null

  return {
    postedAt: posted,
    description,
    amount: Math.abs(signed),
    type,
    balance: null,
    externalId: null,
    documentNumber: null,
    counterparty: null,
    raw: { source: 'pdf', line },
  }
}

function movementsFromLines(text: string): RawMovement[] {
  const movements: RawMovement[] = []
  for (const line of linesFromText(text)) {
    const movement = movementFromLine(line)
    if (movement) movements.push(movement)
  }
  return finalizeMovements(movements)
}

function rowsFromLines(text: string) {
  return linesFromText(text).map((line) =>
    line.split(/\s{2,}|\t/).filter(Boolean),
  )
}

export const pdfParser: StatementParser = {
  id: 'pdf',
  matches(file) {
    return file.format === 'pdf'
  },
  async parse(file: DetectedFile): Promise<ParseResult> {
    const result = emptyResult('pdf')
    const extracted = await extractPdfLayout(file.bytes)
    const collapsed = collapseSpacedGlyphs(extracted.text)
    const sample = (extracted.text || collapsed).slice(0, 4000)
    const detected = detectBank(sample)
    result.bankCode = detected.bankCode
    result.bankName = detected.bankName

    if (extracted.encrypted && extracted.text.replace(/\s+/g, '').length < 40) {
      result.warnings.push({
        message:
          'Este PDF está protegido por senha e não pode ser lido. Exporte o extrato sem senha, ou envie OFX, CSV ou XLSX.',
      })
      return result
    }

    const printable = `${extracted.text}\n${collapsed}`
    if (!looksExtractable(printable)) {
      result.ocrRequired = true
      result.warnings.push({
        message:
          'PDF sem texto extraível. OCR será suportado em breve para extratos digitalizados.',
      })
      return result
    }

    const tableCandidates = [
      extracted.rows,
      extracted.alignedRows,
      rowsFromLines(extracted.text),
      rowsFromLines(collapsed),
    ].filter((rows) => rows.length > 0)

    let bestMovements: RawMovement[] = []
    let bestWarnings: ParseResult['warnings'] = []

    for (const rows of tableCandidates) {
      const tabular = parseTabularRows(rows)
      if (tabular.movements.length > bestMovements.length) {
        bestMovements = tabular.movements
        bestWarnings = tabular.warnings
      }
    }

    const lineMovements = movementsFromLines(
      bestMovements.length === 0 ? `${extracted.text}\n${collapsed}` : extracted.text,
    )
    if (lineMovements.length > bestMovements.length) {
      bestMovements = lineMovements
      bestWarnings = []
    }

    result.movements = finalizeMovements(bestMovements)
    result.warnings = capWarnings(bestWarnings)
    if (result.movements.length === 0) {
      result.warnings.push({
        message: extracted.encrypted
          ? 'Este PDF está protegido por senha e não pode ser lido. Exporte o extrato sem senha, ou envie OFX, CSV ou XLSX.'
          : 'Não foi possível ler lançamentos tabulares neste PDF. Envie OFX, CSV ou XLSX, ou um PDF estruturado.',
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
