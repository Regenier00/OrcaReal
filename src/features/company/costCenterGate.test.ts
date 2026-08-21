import {
  assertCanCreateBudget,
  COST_CENTERS_REQUIRED_FOR_BUDGET_MESSAGE,
} from './costCenterRules.ts'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

assert(
  COST_CENTERS_REQUIRED_FOR_BUDGET_MESSAGE.includes('centro de custo'),
  'mensagem deve citar centro de custo'
)

assert(
  COST_CENTERS_REQUIRED_FOR_BUDGET_MESSAGE.includes('sem destino'),
  'mensagem deve explicar a falta de destino'
)

try {
  assertCanCreateBudget(false)
  throw new Error('deveria bloquear sem centros de custo')
} catch (error) {
  assert(
    error instanceof Error &&
      error.message === COST_CENTERS_REQUIRED_FOR_BUDGET_MESSAGE,
    'assertCanCreateBudget deve lançar a mensagem padrão'
  )
}

assertCanCreateBudget(true)

console.log('costCenterGate.test.ts: ok')
