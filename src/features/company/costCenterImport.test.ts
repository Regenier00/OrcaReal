import {
  assertSafeCostCenterXlsx,
} from '../../../supabase/functions/_shared/costCenters/inspect.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function encode(text: string) {
  return new TextEncoder().encode(text)
}

function throws(fn: () => void, pattern: RegExp, message: string) {
  try {
    fn()
    assert(false, message)
  } catch (error) {
    assert(error instanceof Error, message)
    assert(pattern.test(error.message), `${message}: ${error.message}`)
  }
}

throws(
  () =>
    assertSafeCostCenterXlsx({
      fileName: 'centros.csv',
      mimeType: 'text/csv',
      bytes: encode('nome\nAdmin'),
    }),
  /XLSX/i,
  'rejeita CSV',
)

throws(
  () =>
    assertSafeCostCenterXlsx({
      fileName: 'centros.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      bytes: new Uint8Array(),
    }),
  /vazio/i,
  'rejeita arquivo vazio',
)

throws(
  () =>
    assertSafeCostCenterXlsx({
      fileName: 'centros.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      bytes: encode('not-a-zip'),
    }),
  /não é um XLSX/i,
  'rejeita magic bytes inválidos',
)

assertSafeCostCenterXlsx({
  fileName: 'centros.xlsx',
  mimeType: 'application/octet-stream',
  bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]),
})

console.log('costCenterImport.test.ts: ok')
