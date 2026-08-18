import {
  classifiedAmountForComparison,
  isComparisonCategory,
} from './classified.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

assert(classifiedAmountForComparison('expense', 80) === 80, 'saída entra na comparação')
assert(classifiedAmountForComparison('income', 200) === 0, 'entrada não entra na comparação')
assert(classifiedAmountForComparison('unknown', 10) === 0, 'tipo desconhecido não entra')
assert(isComparisonCategory('expense'), 'despesa entra na apresentação')
assert(isComparisonCategory('cost'), 'custo entra na apresentação')
assert(isComparisonCategory(null), 'linha sem categoria entra na apresentação')
assert(!isComparisonCategory('revenue'), 'receita não entra no orçado x realizado')

const slices = [
  { type: 'expense', amount: 25 },
  { type: 'income', amount: 200 },
  { type: 'expense', amount: 40 },
]
const comparisonActual = slices.reduce(
  (total, slice) => total + classifiedAmountForComparison(slice.type, slice.amount),
  0
)
const revenue = slices
  .filter((slice) => slice.type === 'income')
  .reduce((total, slice) => total + slice.amount, 0)

assert(comparisonActual === 65, 'orçado x realizado soma só saídas')
assert(revenue === 200, 'entradas ficam na receita e nos indicadores')

console.log('comparison classified tests ok')
