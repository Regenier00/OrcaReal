import { groupTransactionsBySuggestion } from './suggestions.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function item(id: string, departmentId: string | null, costCenterId: string | null) {
  return {
    id,
    suggested_category_id: null,
    suggested_department_id: departmentId,
    suggested_cost_center_id: costCenterId,
  }
}

const groups = groupTransactionsBySuggestion([
  item('a', 'adm', 'energia'),
  item('b', 'com', 'mkt'),
  item('c', 'adm', 'energia'),
  item('d', null, null),
])

assert(groups.length === 2, `esperado 2 grupos, veio ${groups.length}`)

const adm = groups.find((group) => group.departmentId === 'adm')
const com = groups.find((group) => group.departmentId === 'com')
assert(adm?.costCenterId === 'energia', 'grupo administrativo')
assert(JSON.stringify(adm?.transactionIds) === JSON.stringify(['a', 'c']), 'ids adm')
assert(com?.costCenterId === 'mkt', 'grupo comercial')
assert(JSON.stringify(com?.transactionIds) === JSON.stringify(['b']), 'ids comercial')

console.log('suggestion grouping tests ok')
