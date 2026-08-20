import { emptyResult } from './normalize.ts'
import type { DetectedErpFile, ErpParseResult, ErpParser } from './types.ts'

/**
 * Placeholder para parser PDF de relatórios contábeis de ERP.
 * Mantém o contrato ErpParser para evolução futura sem espalhar regras.
 */
export const pdfErpParser: ErpParser = {
  id: 'pdf',
  matches(file) {
    return file.format === 'pdf'
  },
  parse(_file: DetectedErpFile): ErpParseResult {
    return emptyResult('pdf', [
      {
        message:
          'Importação PDF de ERP ainda não está disponível. Use XLSX ou CSV por enquanto.',
      },
    ])
  },
}
