import {
  assertCanImportWithChartAccounts,
  CHART_ACCOUNTS_REQUIRED_FOR_IMPORT_MESSAGE,
} from './chartAccountRules.ts'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

assert(
  CHART_ACCOUNTS_REQUIRED_FOR_IMPORT_MESSAGE.includes('classificação'),
  'mensagem deve citar classificação',
)

assert(
  CHART_ACCOUNTS_REQUIRED_FOR_IMPORT_MESSAGE.includes('contas contábeis'),
  'mensagem deve citar contas contábeis',
)

try {
  assertCanImportWithChartAccounts(false)
  throw new Error('deveria bloquear sem classificação')
} catch (error) {
  assert(
    error instanceof Error &&
      error.message === CHART_ACCOUNTS_REQUIRED_FOR_IMPORT_MESSAGE,
    'assertCanImportWithChartAccounts deve lançar a mensagem padrão',
  )
}

assertCanImportWithChartAccounts(true)

console.log('chartAccountGate.test.ts: ok')
