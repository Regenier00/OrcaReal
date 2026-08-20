import { csvErpParser } from './csv.ts'
import { identifyErpFile } from './identify.ts'
import { assertSafeErpFile } from './inspect.ts'
import { ofxErpParser } from './ofx.ts'
import { pdfErpParser } from './pdf.ts'
import type { ErpParseResult, ErpParser } from './types.ts'
import type { SavedHeaderMap } from './columns.ts'
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
  savedHeaders?: SavedHeaderMap,
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
            'Formato não reconhecido. Envie um arquivo XLSX ou CSV.',
        },
      ],
    }
  }

  // Passa mapeamentos salvos via propriedade transitória no arquivo detectado.
  ;(detected as DetectedErpFileWithSaved).savedHeaders = savedHeaders
  return await parser.parse(detected)
}

type DetectedErpFileWithSaved = import('./types.ts').DetectedErpFile & {
  savedHeaders?: SavedHeaderMap
}

export { identifyErpFile, parsers }
export type { SavedHeaderMap }
