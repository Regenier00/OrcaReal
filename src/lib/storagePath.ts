/**
 * Paths de storage no app seguem: `{companyId}/{importId}/{fileName}`.
 * Só aceitamos remoção quando o path começa com a empresa informada.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isCompanyScopedStoragePath(
  companyId: string,
  filePath: string | null | undefined,
): filePath is string {
  if (!filePath || typeof filePath !== 'string') return false
  if (filePath.includes('..') || filePath.startsWith('/')) return false

  const parts = filePath.split('/').filter(Boolean)
  if (parts.length < 3) return false
  if (parts[0] !== companyId) return false
  if (!UUID_RE.test(parts[0]) || !UUID_RE.test(parts[1])) return false

  return true
}
