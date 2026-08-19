import { statementError, statementLog } from './log.ts'

export interface PdfOcrResult {
  text: string
  usedOcr: boolean
}

export interface PdfOcrInput {
  bytes: Uint8Array
  extractedText: string
  forceOcr?: boolean
}

export type PdfOcrProvider = (input: PdfOcrInput) => Promise<PdfOcrResult | null>

let provider: PdfOcrProvider | null = null

export function setPdfOcrProvider(next: PdfOcrProvider | null) {
  provider = next
}

export function hasPdfOcrProvider() {
  return provider != null
}

export async function runPdfOcr(input: PdfOcrInput): Promise<PdfOcrResult | null> {
  if (!provider) {
    statementLog('OCR indisponível neste ambiente')
    return null
  }
  try {
    statementLog(input.forceOcr ? 'Iniciando OCR forçado' : 'Recuperando texto do PDF no navegador')
    return await provider(input)
  } catch (error) {
    statementError('OCR falhou', error)
    return null
  }
}
