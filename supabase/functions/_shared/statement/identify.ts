import { decodeText, sniffFormat } from './inspect.ts'
import { MAX_TEXT_SAMPLE } from './limits.ts'
import type { DetectedFile } from './types.ts'

export function identifyStatement(
  fileName: string,
  bytes: Uint8Array,
): DetectedFile {
  const format = sniffFormat(fileName, bytes)
  const text =
    format === 'xlsx' || format === 'pdf'
      ? decodeText(bytes.subarray(0, Math.min(bytes.length, MAX_TEXT_SAMPLE)))
      : decodeText(bytes)
  return { fileName, bytes, text, format }
}
