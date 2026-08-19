import type { CompanyRole } from '@/types/database'

export function canDeleteImportedStatements(role?: CompanyRole | string | null) {
  return role === 'owner' || role === 'admin'
}
