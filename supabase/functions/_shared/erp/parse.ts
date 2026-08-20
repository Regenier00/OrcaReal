import { csvErpParser } from './csv.ts'
import { identifyErpFile } from './identify.ts'
import { assertSafeErpFile } from './inspect.ts'
import { ofxErpParser } from './ofx.ts'
import { pdfErpParser } from './pdf.ts'
import type { ErpParseResult, ErpParser } from './types.ts'
import { xlsxErpParser } from './xlsx.ts'

/**
 * Registry de parsers. Adicione TOTVS/Sankhya/Omie aqui como ErpParser
 * sem alterar normalização, classificação ou persistência.
 */
const parsers: ErpParser[] = [
  xlsxErpParser,
  csvErpParser,
  ofxErpParser,
  pdfErpParser,
]

export async function parseErpFile(
  fileName: string,
  bytes: Uint8Array,
  mimeType?: string | null,
): Promise<ErpParseResult> {
  assertSafeErpFile(fileName, bytes, mimeType)
  const detected = identifyErpFile(fileName, bytes, mimeType)
  const parser = parsers.find((item) => item.matches(detected))
  if (!parser) {
    return {
      format: 'unknown',
      layout: null,
      entries: [],
      warnings: [
        {
          message:
            'Formato não reconhecido. Envie um arquivo XLSX, CSV, OFX ou PDF.',
        },
      ],
    }
  }
  return await parser.parse(detected)
}

export { identifyErpFile, parsers }
