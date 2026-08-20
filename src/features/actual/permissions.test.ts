import { canDeleteImportedStatements, canImportErp } from './permissions.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

assert(
  canDeleteImportedStatements('owner') === true,
  'dono da empresa (Administrador) pode excluir extrato'
)
assert(
  canDeleteImportedStatements('admin') === true,
  'admin da empresa (Administrador) pode excluir extrato'
)
assert(
  canDeleteImportedStatements('member') === false,
  'membro não exclui extrato importado'
)
assert(
  canDeleteImportedStatements('viewer') === false,
  'visualizador não exclui extrato importado'
)
assert(
  canDeleteImportedStatements(null) === false,
  'sem perfil não exclui extrato importado'
)

assert(canImportErp('owner') === true, 'owner importa ERP')
assert(canImportErp('admin') === true, 'admin importa ERP')
assert(canImportErp('member') === true, 'member importa ERP')
assert(canImportErp('viewer') === false, 'viewer não importa ERP')

console.log('permissions tests ok')
