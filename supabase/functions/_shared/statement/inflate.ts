import { MAX_STATEMENT_BYTES, MAX_UNCOMPRESSED_ENTRY } from './limits.ts'

export async function inflateLimited(
  data: Uint8Array,
  format: CompressionFormat,
  maxBytes = MAX_UNCOMPRESSED_ENTRY,
) {
  if (data.byteLength > MAX_STATEMENT_BYTES) {
    throw new Error('Bloco compactado inválido.')
  }

  const stream = new Blob([data]).stream().pipeThrough(
    new DecompressionStream(format),
  )
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new Error('Arquivo compactado excede o limite seguro de leitura.')
    }
    chunks.push(value)
  }

  const output = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.byteLength
  }
  return output
}
