import {
  allowsNewDestinationName,
  enrichTransactionSuggestion,
  type ClassificationSuggestionContext,
} from './destinationSuggestions.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const destinations = [
  { id: 'd1', moneyGroup: 'cost' as const, name: 'COMBUSTÍVEL' },
  { id: 'd2', moneyGroup: 'expense' as const, name: 'ENERGIA' },
  { id: 'd3', moneyGroup: 'revenue' as const, name: 'VENDA DE SOJA' },
  { id: 'd4', moneyGroup: 'investment' as const, name: 'VEÍCULOS' },
]

const patterns = [
  {
    matchType: 'counterparty' as const,
    matchValue: 'posto xyz',
    moneyGroup: 'cost' as const,
    destinationId: 'd1',
    destinationName: 'COMBUSTÍVEL',
    usageCount: 4,
  },
]

const context: ClassificationSuggestionContext = {
  destinations,
  patterns,
  profileFacts: { crops: ['soja'], products_sold: ['café especial'] },
  segmentCode: 'agro',
}

const byHistory = enrichTransactionSuggestion(
  {
    id: '1',
    description: 'PAGAMENTO DIVERSO',
    suggested_money_group: 'expense',
    suggested_destination_name: 'ENERGIA',
    suggestion_source: 'history',
  },
  context
)
assert(byHistory.source === 'history', 'histórico tem prioridade')
assert(byHistory.label?.includes('ENERGIA'), 'rótulo histórico')

const bySupplier = enrichTransactionSuggestion(
  {
    id: '2',
    description: 'DEB AUTOMATICO',
    counterparty: 'POSTO XYZ',
  },
  context
)
assert(bySupplier.source === 'history', 'fornecedor aprendido')
assert(bySupplier.destinationName === 'COMBUSTÍVEL', 'destino combustível')

const byKeyword = enrichTransactionSuggestion(
  {
    id: '3',
    description: 'PAGTO POSTO IPIRANGA 123',
  },
  context
)
assert(byKeyword.moneyGroup === 'cost', 'palavra-chave posto → custo')
assert(byKeyword.destinationId === 'd1', 'casa com destino combustível do orçamento')

const inventedCost = enrichTransactionSuggestion(
  {
    id: '3b',
    description: 'PAGTO FRETE EXPRESSO',
  },
  context
)
assert(inventedCost.moneyGroup === 'cost', 'palavra-chave frete → custo')
assert(
  inventedCost.destinationName == null,
  'não inventa destino de custo sem centro de custo'
)

const byProduct = enrichTransactionSuggestion(
  {
    id: '4',
    description: 'TED CLIENTE SOJA LOTE 12',
    type: 'income',
  },
  context
)
assert(byProduct.moneyGroup === 'revenue', 'produto do cadastro → receita')
assert(byProduct.destinationId === 'd3', 'casa com venda de soja')

const inventedRevenue = enrichTransactionSuggestion(
  {
    id: '5',
    description: 'TED CLIENTE CAFÉ ESPECIAL',
    type: 'income',
  },
  context
)
assert(inventedRevenue.moneyGroup === 'revenue', 'produto conhecido → receita')
assert(
  inventedRevenue.destinationName == null,
  'não inventa destino de receita fora do orçamento'
)

assert(allowsNewDestinationName('revenue'), 'receita pode ter destino novo no orçamento')
assert(allowsNewDestinationName('investment'), 'investimento pode ter destino novo')
assert(!allowsNewDestinationName('cost'), 'custo não cria destino inventado')
assert(!allowsNewDestinationName('expense'), 'despesa não cria destino inventado')

console.log('destination suggestion tests ok')
