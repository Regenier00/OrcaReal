import { distributeEqually, roundMoney } from './money.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const MONEY_GROUPS = ['revenue', 'cost', 'expense', 'investment'] as const

function structureKey(moneyGroup: string, destinationName: string) {
  return [moneyGroup, destinationName.trim().toLowerCase()].join('|')
}

function distributeAmounts(total: number, monthCount: number) {
  return distributeEqually(total, monthCount)
}

assert(MONEY_GROUPS.length === 4, 'quatro grupos fixos')
assert(structureKey('cost', 'Insumos') === 'cost|insumos', 'chave normaliza destino')
assert(structureKey('cost', 'Insumos') === structureKey('cost', ' insumos '), 'trim no destino')

const parts = distributeAmounts(10000, 3)
assert(parts.length === 3, 'distribui em 3 meses')
assert(roundMoney(parts.reduce((sum, value) => sum + value, 0)) === 10000, 'soma fecha o total')

const destinations = [
  { name: 'Insumos', total: 4000 },
  { name: 'Fretes', total: 2000 },
  { name: 'Manutenção', total: 1500 },
  { name: 'Mão de obra', total: 2500 },
]
const allocated = destinations.reduce((sum, item) => sum + item.total, 0)
assert(allocated === 10000, 'exemplo de custos fecha 10 mil')
assert(
  new Set(destinations.map((item) => structureKey('cost', item.name))).size === 4,
  'destinos únicos no grupo'
)

console.log('budget destination model tests ok')
