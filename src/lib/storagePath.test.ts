import { isCompanyScopedStoragePath } from './storagePath.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const companyId = '11111111-1111-4111-8111-111111111111'
const importId = '22222222-2222-4222-8222-222222222222'
const validPath = `${companyId}/${importId}/planilha.xlsx`

assert(
  isCompanyScopedStoragePath(companyId, validPath) === true,
  'aceita path company/import/arquivo',
)

assert(
  isCompanyScopedStoragePath(companyId, null) === false,
  'recusa path nulo',
)

assert(
  isCompanyScopedStoragePath(companyId, '') === false,
  'recusa path vazio',
)

assert(
  isCompanyScopedStoragePath(
    companyId,
    `${companyId}/${importId}`,
  ) === false,
  'exige pelo menos 3 segmentos',
)

assert(
  isCompanyScopedStoragePath(
    companyId,
    `99999999-9999-4999-8999-999999999999/${importId}/a.xlsx`,
  ) === false,
  'recusa path de outra empresa',
)

assert(
  isCompanyScopedStoragePath(companyId, `../${validPath}`) === false,
  'recusa traversal',
)

assert(
  isCompanyScopedStoragePath(companyId, `/${validPath}`) === false,
  'recusa path absoluto',
)

assert(
  isCompanyScopedStoragePath(companyId, `${companyId}/not-a-uuid/a.xlsx`) ===
    false,
  'recusa importId inválido',
)

console.log('storagePath tests ok')
