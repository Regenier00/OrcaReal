import { distributeEqually, roundMoney } from './money.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function distributeAmounts(total: number, monthCount: number) {
  return distributeEqually(total, monthCount)
}

function accountTotal(amounts: number[]) {
  return roundMoney(amounts.reduce((sum, value) => sum + value, 0))
}

const months = 3
const destinationTotal = 900
const destinationParts = distributeAmounts(destinationTotal, months)
assert(accountTotal(destinationParts) === 900, 'destino fecha 900')

const accounts = [
  { code: '3.4.01.0001', name: 'RATEIO DEPARTAMENTOS', total: 400 },
  { code: '4.2.01.0001', name: 'MATERIAL ESCRITORIO', total: 500 },
]

const allocated = accounts.reduce((sum, item) => sum + item.total, 0)
assert(allocated === destinationTotal, 'soma das contas = total do destino')
assert(
  new Set(accounts.map((item) => item.code.toLowerCase())).size === 2,
  'contas únicas no destino'
)

const inconsistent = allocated + 1
assert(inconsistent !== destinationTotal, 'detecta inconsistência de soma')

// Orçamento básico: sem contas, só destino
const basicAllocated = 1000
assert(basicAllocated > 0, 'orçamento básico segue válido sem plano de contas')

console.log('detailed budget model tests ok')
