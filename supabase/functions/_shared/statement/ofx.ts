import { detectBank } from './banks.ts'
import {
  capWarnings,
  emptyResult,
  finalizeMovements,
  parseAmount,
  parseBrazilianDate,
  typeFromSignedAmount,
} from './normalize.ts'
import type { DetectedFile, ParseResult, RawMovement, StatementParser } from './types.ts'

function tagValue(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i')
  const match = block.match(re)
  return match ? match[1].trim() : null
}

function closeSgmlTags(content: string) {
  return content.replace(
    /<([A-Z0-9.]+)>([^<\r\n]+)/gi,
    '<$1>$2</$1>',
  )
}

export const ofxParser: StatementParser = {
  id: 'ofx',
  matches(file) {
    return file.format === 'ofx'
  },
  parse(file: DetectedFile): ParseResult {
    const result = emptyResult('ofx')
    const bodyIndex = file.text.search(/<OFX>/i)
    const body = bodyIndex >= 0 ? file.text.slice(bodyIndex) : file.text
    const xml = closeSgmlTags(body)

    const bankId = tagValue(xml, 'BANKID')
    const org = tagValue(xml, 'ORG')
    const detected = detectBank(`${org ?? ''} ${file.text}`, bankId)
    result.bankCode = detected.bankCode
    result.bankName = detected.bankName ?? org
    result.accountHint = tagValue(xml, 'ACCTID')
    result.currency = tagValue(xml, 'CURDEF') ?? 'BRL'

    const movements: RawMovement[] = []
    const blocks = xml.split(/<STMTTRN>/i).slice(1)

    for (const block of blocks) {
      const trnType = (tagValue(block, 'TRNTYPE') ?? '').toUpperCase()
      const posted = parseBrazilianDate(tagValue(block, 'DTPOSTED') ?? '')
      const signed = parseAmount(tagValue(block, 'TRNAMT') ?? '0')
      const memo = tagValue(block, 'MEMO') ?? tagValue(block, 'NAME') ?? ''
      const fitId = tagValue(block, 'FITID')
      const checkNum = tagValue(block, 'CHECKNUM')

      if (!posted || signed == null || !memo) {
        result.warnings.push({ message: 'Lançamento OFX incompleto ignorado' })
        continue
      }

      let type = typeFromSignedAmount(signed, memo)
      if (trnType === 'XFER' || trnType === 'TRANSFER') type = 'transfer'
      if (trnType === 'CREDIT' && type === 'unknown') type = 'income'
      if (trnType === 'DEBIT' && type === 'unknown') type = 'expense'

      movements.push({
        postedAt: posted,
        description: memo,
        amount: Math.abs(signed),
        type,
        balance: null,
        externalId: fitId,
        documentNumber: checkNum,
        counterparty: tagValue(block, 'NAME'),
        raw: { trnType, fitId },
      })
    }

    result.movements = finalizeMovements(movements)
    result.warnings = capWarnings(result.warnings)
    if (result.movements.length === 0) {
      result.warnings.push({ message: 'Nenhum lançamento encontrado no OFX' })
    }
    return result
  },
}
