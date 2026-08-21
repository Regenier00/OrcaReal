import {
  assertCanImportWithBudget,
  BUDGET_REQUIRED_FOR_IMPORT_MESSAGE,
} from './budgetRules.ts'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

assert(
  BUDGET_REQUIRED_FOR_IMPORT_MESSAGE.includes('orçamento'),
  'mensagem deve citar orçamento',
)

assert(
  BUDGET_REQUIRED_FOR_IMPORT_MESSAGE.includes('extrato'),
  'mensagem deve citar extrato',
)

try {
  assertCanImportWithBudget(false)
  throw new Error('deveria bloquear sem orçamento')
} catch (error) {
  assert(
    error instanceof Error &&
      error.message === BUDGET_REQUIRED_FOR_IMPORT_MESSAGE,
    'assertCanImportWithBudget deve lançar a mensagem padrão',
  )
}

assertCanImportWithBudget(true)

console.log('budgetGate.test.ts: ok')
