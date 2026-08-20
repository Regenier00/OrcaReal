import {
  enrichTransactionSuggestion,
  type ClassificationSuggestionContext,
} from './destinationSuggestions.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const destinations = [
  { id: 'd1', moneyGroup: 'cost' as const, name: 'COMBUSTíVEL' },
  { id: 'd2', moneyGroup: 'expense' as const, name: 'ENERGIA' },
  { id: 'd3', moneyGroup: 'revenue' as const, name: 'VENDA DE SOJA' },
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

console.log('destination suggestion tests ok')
