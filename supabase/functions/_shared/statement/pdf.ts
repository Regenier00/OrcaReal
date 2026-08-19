import { parseTabularRows } from './csv.ts'
import { scoreTabularMovements } from './columns.ts'
import { detectBank } from './banks.ts'
import { statementLog, statementWarn } from './log.ts'
import {
  capWarnings,
  emptyResult,
  finalizeMovements,
  inferStatementYear,
  parseAmount,
  parseBrazilianDate,
  scoreParsedMovements,
  typeFromLabel,
  typeFromSignedAmount,
} from './normalize.ts'
import { hasPdfOcrProvider, runPdfOcr } from './ocr.ts'
import { extractPdfLayout, type PdfExtraction } from './pdfExtract.ts'
import type {
  DetectedFile,
  ParseResult,
  RawMovement,
  StatementParser,
} from './types.ts'

const DATE_PATTERN =
  '(?<![\\d./-])\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4}(?:\\s*[-–—]\\s*\\d{1,2}:\\d{2}(?::\\d{2})?)?|(?<![\\d./-])\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4}|(?<![\\d./-])\\d{1,2}[./\\-\\s]+[A-Za-zÀ-ÿ]{3,9}\\.?[./\\-\\s]+\\d{2,4}|(?<![\\d./-])\\d{1,2}[/\\-]\\d{1,2}(?![\\d./-])'
const DATE_RE = new RegExp(`(${DATE_PATTERN})`)
const DATE_SPLIT_RE = new RegExp(`(?=${DATE_PATTERN})`)
const AMOUNT_PATTERN =
  '(?:R\\$\\s*)?-?\\d{1,3}(?:[.\\s]\\d{3})*,\\d{2}-?|(?:R\\$\\s*)?-?\\d+[.,]\\d{2}-?|\\(\\d{1,3}(?:[.\\s]\\d{3})*,\\d{2}\\)|\\d{1,3}(?:[.\\s]\\d{3})*,\\d{2}\\s*[DdCc]'

function amountRegex() {
  return new RegExp(AMOUNT_PATTERN, 'g')
}
const SKIP_LINE =
  /saldo\s*(anterior|inicial|final|atual|dia)|^saldo$|opening balance|closing balance|^totais?$|^subtotal$|^per[ií]odo\b|^p[aá]gina\b|^agencia\b|^ag[eê]ncia\b/i
const STOP_SECTION =
  /(?:^|\s)(?:totais?|total\s+geral|resumo\s+do\s+per[ií]odo|total\s+de\s+(?:cr[eé]ditos|d[eé]bitos|lan[cç]amentos))(?:\s|$)/i

function amountHasDebitCreditLabel(raw: string) {
  return /\d,\d{2}\s*[DdCc]\b/.test(raw) || /\b[DdCc]\s*$/.test(raw.trim())
}

function pickAmount(line: string) {
  const matches = [...line.matchAll(amountRegex())]
  if (matches.length === 0) return null

  let chosen = matches[matches.length - 1]
  if (matches.length >= 2) {
    const labeled = matches.filter((match) => amountHasDebitCreditLabel(match[0]))
    if (labeled.length === 1) {
      chosen = labeled[0]
    } else {
      chosen = matches[matches.length - 2]
      const lastVal = Math.abs(parseAmount(matches[matches.length - 1][0]) ?? 0)
      const secondVal = Math.abs(parseAmount(chosen[0]) ?? 0)
      if (
        lastVal > 0 &&
        secondVal > 0 &&
        lastVal > secondVal * 4 &&
        !amountHasDebitCreditLabel(chosen[0]) &&
        !amountHasDebitCreditLabel(matches[matches.length - 1][0])
      ) {
        chosen = matches[matches.length - 2]
      }
    }
  }

  const signed = parseAmount(chosen[0])
  if (signed == null || signed === 0) return null
  const after = line.slice(chosen.index ?? 0)
  const suffix = after.match(/^\s*(?:R\$\s*)?[^\s]*\s*([DdCc])\b/)
  const labeled = suffix ? typeFromLabel(suffix[1]) : typeFromLabel(chosen[0])
  return { raw: chosen[0], signed, labeled }
}

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

function cleanExtractedStatementText(text: string) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\b[Oo](?=\d[./-])/g, '0')
    .replace(/(\d[./-])[Oo](?=[./\d-])/g, '$10')
    .replace(/(\d{2}:\d{2}(?::\d{2})?)(\d)/g, '$1 $2')
    .replace(/(\d{1,3})\s+(\d{3},\d{2})\b/g, '$1.$2')
    .replace(/(\d),\s+(\d{2})\b/g, '$1,$2')
}

function linesFromText(text: string) {
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(DATE_SPLIT_RE))
    .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 12_000)
}

function lineHasDate(line: string) {
  return DATE_RE.test(line)
}

function lineHasAmount(line: string) {
  return amountRegex().test(line)
}

function lineHasDescription(line: string) {
  const stripped = line
    .replace(DATE_RE, ' ')
    .replace(amountRegex(), ' ')
    .replace(/\b[DdCc]\b/g, ' ')
  return /[a-zA-ZÀ-ÿ]/.test(stripped)
}

function mergeStatementLines(lines: string[]) {
  const merged: string[] = []
  let pending = ''
  let lastDate = ''
  for (const line of lines) {
    const hasDate = lineHasDate(line)
    const hasAmount = lineHasAmount(line)
    if (hasDate) lastDate = line.match(DATE_RE)?.[1] ?? lastDate
    if (hasDate && hasAmount) {
      if (pending) merged.push(pending)
      if (lineHasDescription(line)) {
        merged.push(line)
        pending = ''
      } else {
        pending = line
      }
      continue
    }
    if (hasDate && !hasAmount) {
      if (pending) merged.push(pending)
      pending = line
      continue
    }
    if (!hasDate && hasAmount) {
      const prefix = pending || lastDate
      merged.push(prefix ? `${prefix} ${line}` : line)
      pending = ''
      continue
    }
    if (pending) pending = `${pending} ${line}`
    else if (lastDate && /[a-zA-ZÀ-ÿ]/.test(line)) pending = `${lastDate} ${line}`
  }
  if (pending) merged.push(pending)
  return merged
}

function movementsFromLines(text: string, defaultYear: number): RawMovement[] {
  const movements: RawMovement[] = []
  for (const line of mergeStatementLines(linesFromText(text))) {
    if (STOP_SECTION.test(line.toLowerCase())) break
    const movement = movementFromLine(line, defaultYear)
    if (movement) movements.push(movement)
  }
  return finalizeMovements(movements)
}

function movementFromLine(
  line: string,
  defaultYear: number,
): RawMovement | null {
  const dateMatch = line.match(DATE_RE)
  if (!dateMatch) return null
  const posted = parseBrazilianDate(dateMatch[1], { defaultYear })
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

function rowsFromLines(text: string) {
  return linesFromText(text).map((line) =>
    line.split(/\s{2,}|\t/).filter(Boolean),
  )
}

function rowsFromLooseText(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/\t/g, '  ').trim())
    .filter(Boolean)
    .map((line) =>
      line
        .split(/\s{2,}/)
        .map((cell) => cell.trim())
        .filter(Boolean),
    )
    .slice(0, 12_000)
}

function uniquePdfTexts(texts: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const text of texts) {
    const key = text.replace(/\s+/g, ' ').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(text)
  }
  return out
}

function parsePdfLayout(
  extracted: Pick<PdfExtraction, 'text' | 'rows' | 'alignedRows'>,
  collapsed: string,
) {
  const sampleText = `${extracted.text}\n${collapsed}`
  const defaultYear = inferStatementYear(sampleText)
  const tableCandidates = [
    extracted.rows,
    extracted.alignedRows,
    rowsFromLooseText(extracted.text),
    rowsFromLooseText(collapsed),
    rowsFromLines(extracted.text),
    rowsFromLines(collapsed),
  ].filter((rows) => rows.length > 0)

  let bestMovements: RawMovement[] = []
  let bestWarnings: ParseResult['warnings'] = []
  let bestScore = -1

  for (const rows of tableCandidates) {
    const tabular = parseTabularRows(rows)
    const score = scoreTabularMovements(tabular.movements, sampleText)
    if (score > bestScore) {
      bestScore = score
      bestMovements = tabular.movements
      bestWarnings = tabular.warnings
    }
  }

  const lineSource = uniquePdfTexts([extracted.text, collapsed]).join('\n')
  const lineMovements = movementsFromLines(lineSource, defaultYear)
  const lineScore = scoreParsedMovements(lineMovements, sampleText)
  if (lineScore > bestScore) {
    bestMovements = lineMovements
    bestWarnings = []
  }

  return {
    movements: finalizeMovements(bestMovements),
    warnings: capWarnings(bestWarnings),
  }
}

function applyBankHint(result: ParseResult, sample: string) {
  const detected = detectBank(sample)
  if (!detected.bankName && !detected.bankCode) return
  result.bankCode = detected.bankCode
  result.bankName = detected.bankName
}

export const pdfParser: StatementParser = {
  id: 'pdf',
  matches(file) {
    return file.format === 'pdf'
  },
  async parse(file: DetectedFile): Promise<ParseResult> {
    const result = emptyResult('pdf')
    const extracted = await extractPdfLayout(file.bytes)
    const collapsed = collapseSpacedGlyphs(
      cleanExtractedStatementText(extracted.text),
    )
    const cleanedText = cleanExtractedStatementText(extracted.text)
    extracted.text = cleanedText
    applyBankHint(result, (extracted.text || collapsed).slice(0, 4000))
    statementLog('PDF extraído', {
      arquivo: file.fileName,
      caracteres: extracted.text.replace(/\s+/g, '').length,
      linhas: extracted.rows.length,
      criptografado: extracted.encrypted,
    })

    if (extracted.encrypted && extracted.text.replace(/\s+/g, '').length < 40) {
      result.warnings.push({
        message:
          'Este PDF está protegido por senha e não pode ser lido. Exporte o extrato sem senha, ou envie OFX, CSV ou XLSX.',
      })
      statementWarn('PDF protegido por senha')
      return result
    }

    const parsed = parsePdfLayout(extracted, collapsed)
    result.movements = parsed.movements
    result.warnings = parsed.warnings
    statementLog('Primeira leitura do PDF', {
      lancamentos: result.movements.length,
    })

    const applyRecovered = async (forceOcr: boolean) => {
      const recovered = await runPdfOcr({
        bytes: file.bytes,
        extractedText: `${extracted.text}\n${collapsed}`,
        forceOcr,
      })
      if (!recovered?.text.trim()) {
        statementLog(forceOcr ? 'OCR não devolveu texto' : 'pdf.js não devolveu texto extra')
        return recovered
      }
      const recoveredText = cleanExtractedStatementText(recovered.text)
      const ocrCollapsed = collapseSpacedGlyphs(recoveredText)
      const recoveredParsed = parsePdfLayout(
        {
          text: recoveredText,
          rows: rowsFromLooseText(recoveredText),
          alignedRows: rowsFromLooseText(ocrCollapsed),
        },
        ocrCollapsed,
      )
      statementLog(recovered.usedOcr ? 'OCR concluído' : 'Texto do pdf.js', {
        caracteres: recoveredText.replace(/\s+/g, '').length,
        lancamentos: recoveredParsed.movements.length,
      })
      if (recoveredParsed.movements.length > result.movements.length) {
        result.movements = recoveredParsed.movements
        result.warnings = recoveredParsed.warnings
        applyBankHint(result, recoveredText.slice(0, 4000))
        if (recovered.usedOcr) {
          result.warnings = capWarnings([
            { message: 'PDF digitalizado: lançamentos lidos por OCR.' },
            ...result.warnings,
          ])
        }
      }
      return recovered
    }

    if (result.movements.length === 0) {
      const recovered = await applyRecovered(false)
      if (result.movements.length === 0 && recovered && !recovered.usedOcr) {
        await applyRecovered(true)
      } else if (result.movements.length === 0 && !recovered) {
        await applyRecovered(true)
      }
    }

    if (result.movements.length === 0) {
      const printable = `${extracted.text}\n${collapsed}`
      if (!looksExtractable(printable) && !hasPdfOcrProvider()) {
        result.ocrRequired = true
        result.warnings.push({
          message:
            'PDF sem texto extraível. Envie OFX, CSV, XLSX ou um PDF com texto selecionável.',
        })
        statementWarn('PDF sem texto extraível e sem OCR neste ambiente')
        return result
      }
      const message = extracted.encrypted
        ? 'Este PDF está protegido por senha e não pode ser lido. Exporte o extrato sem senha, ou envie OFX, CSV ou XLSX.'
        : 'Não foi possível ler lançamentos neste PDF. Envie OFX, CSV ou XLSX, ou um PDF com texto mais nítido.'
      result.warnings.push({ message })
      statementWarn('Nenhum lançamento identificado no PDF', {
        caracteres: printable.replace(/\s+/g, '').length,
        ocrDisponivel: hasPdfOcrProvider(),
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
      message:
        'PDF sem texto extraível. Envie OFX, CSV, XLSX ou um PDF com texto selecionável.',
    })
    return result
  },
}
