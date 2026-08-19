export interface PdfOcrResult {
  text: string
  usedOcr: boolean
}

export interface PdfOcrInput {
  bytes: Uint8Array
  extractedText: string
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
  if (!provider) return null
  try {
    return await provider(input)
  } catch {
    return null
  }
}
