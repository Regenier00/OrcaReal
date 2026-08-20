import type { CompanyRole } from '@/types/database'

export function canDeleteImportedStatements(role?: CompanyRole | string | null) {
  return role === 'owner' || role === 'admin'
}

/** Importar / classificar ERP: owner, admin e member (exclui viewer). */
export function canImportErp(role?: CompanyRole | string | null) {
  return role === 'owner' || role === 'admin' || role === 'member'
}

export function canClassifyErp(role?: CompanyRole | string | null) {
  return canImportErp(role)
}
