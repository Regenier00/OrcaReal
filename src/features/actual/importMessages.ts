export function completedStatementMessage(item: {
  transaction_count: number
  duplicate_count?: number
}) {
  const success = 'Extrato importado com sucesso'
  if (item.transaction_count === 1) {
    return `${success}. 1 lançamento lido.`
  }
  if (item.transaction_count > 1) {
    return `${success}. ${item.transaction_count} lançamentos lidos.`
  }
  return `${success}.`
}
