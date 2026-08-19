type CreateWorker = (typeof import('tesseract.js'))['createWorker']

function asCreateWorker(value: unknown): CreateWorker | null {
  return typeof value === 'function' ? (value as CreateWorker) : null
}

export function resolveCreateWorker(mod: unknown): CreateWorker {
  if (!mod || typeof mod !== 'object') {
    throw new Error('tesseract.js não exportou createWorker')
  }
  const record = mod as Record<string, unknown>
  const nested = record.default
  const nestedRecord =
    nested && typeof nested === 'object' ? (nested as Record<string, unknown>) : null
  const resolved =
    asCreateWorker(record.createWorker) ??
    asCreateWorker(nestedRecord?.createWorker) ??
    asCreateWorker(nested)
  if (!resolved) {
    throw new Error('tesseract.js não exportou createWorker')
  }
  return resolved
}

export async function loadCreateWorker(): Promise<CreateWorker> {
  return resolveCreateWorker(await import('tesseract.js'))
}
