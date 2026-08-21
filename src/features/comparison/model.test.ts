import {
  classifiedAmountForComparison,
  isComparisonCategory,
  isComparisonMoneyGroup,
} from './classified.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

assert(classifiedAmountForComparison('expense', 80) === 80, 'saída entra na comparação')
assert(classifiedAmountForComparison('income', 200) === 0, 'entrada não entra na comparação')
assert(classifiedAmountForComparison('unknown', 10) === 0, 'tipo desconhecido não entra')
assert(
  classifiedAmountForComparison('expense', 50, 'investment') === 0,
  'investimento não entra na comparação'
)
assert(
  classifiedAmountForComparison('expense', 50, 'revenue') === 0,
  'receita por grupo não entra na comparação'
)
assert(
  classifiedAmountForComparison('expense', 50, 'cost') === 50,
  'custo por grupo entra na comparação'
)
assert(isComparisonCategory('expense'), 'despesa entra na apresentação')
assert(isComparisonCategory('cost'), 'custo entra na apresentação')
assert(isComparisonCategory(null), 'linha sem categoria entra na apresentação')
assert(!isComparisonCategory('revenue'), 'receita não entra no orçado x realizado')
assert(isComparisonMoneyGroup('cost'), 'grupo custo entra na apresentação')
assert(isComparisonMoneyGroup('expense'), 'grupo despesa entra na apresentação')
assert(!isComparisonMoneyGroup('revenue'), 'grupo receita não entra')
assert(!isComparisonMoneyGroup('investment'), 'grupo investimento não entra')

const slices = [
  { type: 'expense', amount: 25, moneyGroup: 'cost' as string | null },
  { type: 'income', amount: 200, moneyGroup: 'revenue' as string | null },
  { type: 'expense', amount: 40, moneyGroup: 'expense' as string | null },
  { type: 'expense', amount: 90, moneyGroup: 'investment' as string | null },
]
const comparisonActual = slices.reduce(
  (total, slice) =>
    total +
    classifiedAmountForComparison(slice.type, slice.amount, slice.moneyGroup),
  0
)
const revenue = slices
  .filter((slice) => slice.type === 'income')
  .reduce((total, slice) => total + slice.amount, 0)
const investment = slices
  .filter((slice) => slice.moneyGroup === 'investment')
  .reduce((total, slice) => total + slice.amount, 0)

assert(comparisonActual === 65, 'orçado x realizado soma só custos e despesas')
assert(revenue === 200, 'entradas ficam na receita e nos indicadores')
assert(investment === 90, 'investimentos ficam fora do orçado x realizado')

console.log('comparison classified tests ok')
