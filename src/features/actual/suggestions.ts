export function hasSuggestion(item: {
  suggested_category_id: string | null
  suggested_department_id: string | null
  suggested_cost_center_id: string | null
  suggested_money_group?: string | null
  suggested_destination_name?: string | null
}) {
  return Boolean(
    item.suggested_category_id ||
      item.suggested_department_id ||
      item.suggested_cost_center_id ||
      item.suggested_money_group ||
      item.suggested_destination_name
  )
}

export interface SuggestionAssignment {
  departmentId: string | null
  costCenterId: string | null
  categoryId: string | null
  moneyGroup: string | null
  destinationId: string | null
  destinationName: string | null
  transactionIds: string[]
}

export function groupTransactionsBySuggestion(
  transactions: Array<{
    id: string
    suggested_category_id: string | null
    suggested_department_id: string | null
    suggested_cost_center_id: string | null
    suggested_money_group?: string | null
    suggested_destination_id?: string | null
    suggested_destination_name?: string | null
  }>,
): SuggestionAssignment[] {
  const groups = new Map<string, SuggestionAssignment>()
  for (const item of transactions) {
    if (!hasSuggestion(item)) continue
    const key = [
      item.suggested_money_group ?? '',
      item.suggested_destination_id ?? '',
      item.suggested_destination_name ?? '',
      item.suggested_department_id ?? '',
      item.suggested_cost_center_id ?? '',
      item.suggested_category_id ?? '',
    ].join('|')
    const current = groups.get(key)
    if (current) {
      current.transactionIds.push(item.id)
      continue
    }
    groups.set(key, {
      moneyGroup: item.suggested_money_group ?? null,
      destinationId: item.suggested_destination_id ?? null,
      destinationName: item.suggested_destination_name ?? null,
      departmentId: item.suggested_department_id,
      costCenterId: item.suggested_cost_center_id,
      categoryId: item.suggested_category_id,
      transactionIds: [item.id],
    })
  }
  return [...groups.values()]
}
