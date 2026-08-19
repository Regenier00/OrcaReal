import { canDeleteImportedStatements } from './permissions.ts'

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

console.log('permissions tests ok')
