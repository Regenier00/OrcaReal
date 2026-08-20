import { emptyResult } from './normalize.ts'
import type { DetectedErpFile, ErpParseResult, ErpParser } from './types.ts'

/**
 * Placeholder para parser OFX de ERP / conciliação contábil.
 * A arquitetura já despacha por formato; implementações específicas
 * (ex.: extrato contábil OFX de um ERP) entram aqui sem alterar o restante.
 */
export const ofxErpParser: ErpParser = {
  id: 'ofx',
  matches(file) {
    return file.format === 'ofx'
  },
  parse(_file: DetectedErpFile): ErpParseResult {
    return emptyResult('ofx', [
      {
        message:
          'Importação OFX de ERP ainda não está disponível. Use XLSX ou CSV por enquanto.',
      },
    ])
  },
}
