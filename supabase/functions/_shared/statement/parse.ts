import { csvParser } from './csv.ts'
import { identifyStatement } from './identify.ts'
import { ofxParser } from './ofx.ts'
import { ocrParser, pdfParser } from './pdf.ts'
import type { ParseResult, StatementParser } from './types.ts'
import { xlsxParser } from './xlsx.ts'

const parsers: StatementParser[] = [
  ofxParser,
  csvParser,
  xlsxParser,
  pdfParser,
  ocrParser,
]

export async function parseStatement(
  fileName: string,
  bytes: Uint8Array,
): Promise<ParseResult> {
  const detected = identifyStatement(fileName, bytes)
  const parser = parsers.find((item) => item.matches(detected))
  if (!parser) {
    return {
      format: 'unknown',
      bankName: null,
      bankCode: null,
      accountHint: null,
      currency: 'BRL',
      movements: [],
      warnings: [
        {
          message:
            'Formato não reconhecido. Envie um arquivo OFX, CSV, XLSX ou PDF estruturado.',
        },
      ],
      ocrRequired: false,
    }
  }

  return await parser.parse(detected)
}

export { identifyStatement, parsers }
