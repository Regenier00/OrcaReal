import { decodeText, sniffErpFormat } from './inspect.ts'
import { MAX_TEXT_SAMPLE } from './limits.ts'
import type { DetectedErpFile } from './types.ts'

export function identifyErpFile(
  fileName: string,
  bytes: Uint8Array,
  mimeType?: string | null,
): DetectedErpFile {
  const format = sniffErpFormat(fileName, bytes)
  const text =
    format === 'xlsx' || format === 'pdf'
      ? ''
      : decodeText(bytes.subarray(0, Math.min(bytes.length, MAX_TEXT_SAMPLE)))

  return {
    fileName,
    bytes,
    text,
    format,
    mimeType: mimeType ?? null,
  }
}
