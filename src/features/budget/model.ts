import type { BudgetPeriodKind, BudgetStatus, CategoryType, MoneyGroup } from '@/types/database'
import type { BudgetMonth } from '@/features/budget/period'
import { applyPercent, distributeEqually, roundMoney } from '@/features/budget/money'
import { sum } from '@/lib/money'

export type { MoneyGroup }

export const MONEY_GROUPS: ReadonlyArray<{
  id: MoneyGroup
  label: string
  description: string
  question: string
}> = [
  {
    id: 'revenue',
    label: 'Receitas',
    description: 'Dinheiro que entra no negócio.',
    question: 'Quanto você espera receber neste período?',
  },
  {
    id: 'cost',
    label: 'Custos',
    description: 'Gastos ligados diretamente ao que você entrega.',
    question: 'Quanto quer destinar a custos?',
  },
  {
    id: 'expense',
    label: 'Despesas',
    description: 'Gastos de estrutura e operação do dia a dia.',
    question: 'Quanto quer destinar a despesas?',
  },
  {
    id: 'investment',
    label: 'Investimentos',
    description: 'Aplicações que fortalecem o negócio no médio prazo.',
    question: 'Quanto quer destinar a investimentos?',
  },
] as const

export const MONEY_GROUP_LABEL: Record<MoneyGroup, string> = {
  revenue: 'Receitas',
  cost: 'Custos',
  expense: 'Despesas',
  investment: 'Investimentos',
}

/** Custos e despesas usam os centros de custo do usuário como destinos. */
export const COST_CENTER_MONEY_GROUPS: ReadonlyArray<MoneyGroup> = [
  'cost',
  'expense',
]

/** Receitas e investimentos usam destinos sugeridos/definidos no orçamento. */
export const BUDGET_DEFINED_MONEY_GROUPS: ReadonlyArray<MoneyGroup> = [
  'revenue',
  'investment',
]

export function usesCostCenterDestinations(moneyGroup: MoneyGroup | '' | null | undefined) {
  return moneyGroup === 'cost' || moneyGroup === 'expense'
}

export interface DraftBudgetAccount {
  localId: string
  ledgerAccountId?: string
  accountCode: string
  accountName: string
  amounts: Record<string, number>
}

export interface DraftBudgetItem {
  localId: string
  moneyGroup: MoneyGroup | ''
  destinationName: string
  destinationId?: string
  businessUnitId: string
  departmentId: string
  costCenterId: string
  activityId?: string
  categoryId?: string
  /** Quando true, a linha tem detalhamento por conta contábil. */
  isDetailed?: boolean
  accounts?: DraftBudgetAccount[]
  amounts: Record<string, number>
}

export interface DraftGroupTotal {
  moneyGroup: MoneyGroup
  total: number
}

export interface DraftBudget {
  id?: string
  name: string
  fiscalYear: number
  periodLabel: string
  periodKind: BudgetPeriodKind
  startDate: string
  endDate: string
  businessUnitId: string
  notes: string
  status: BudgetStatus
  groupTotals: DraftGroupTotal[]
  items: DraftBudgetItem[]
}

export interface NamedRef {
  id: string
  name: string
  code?: string | null
  category_type?: CategoryType
}

export interface LoadedBudgetItem extends DraftBudgetItem {
  id: string
  businessUnitName: string | null
  departmentName: string
  costCenterName: string
  activityName: string
  categoryName: string
  categoryType: CategoryType | null
}

export interface LoadedGroupTotal extends DraftGroupTotal {
  amounts: Record<string, number>
}

export interface LoadedBudget extends DraftBudget {
  id: string
  companyId: string
  createdAt: string
  updatedAt: string
  businessUnitName: string | null
  groupTotals: LoadedGroupTotal[]
  items: LoadedBudgetItem[]
}

export function newLocalId() {
  return crypto.randomUUID()
}

export function emptyAmounts(months: BudgetMonth[]): Record<string, number> {
  return Object.fromEntries(months.map((month) => [month.key, 0]))
}

export function emptyGroupTotals(): DraftGroupTotal[] {
  return MONEY_GROUPS.map((group) => ({
    moneyGroup: group.id,
    total: 0,
  }))
}

export function structureKey(
  item: Pick<
    DraftBudgetItem,
    | 'businessUnitId'
    | 'departmentId'
    | 'costCenterId'
    | 'moneyGroup'
    | 'destinationName'
  >
) {
  if (item.moneyGroup) {
    return [item.moneyGroup, item.destinationName.trim().toLowerCase()].join('|')
  }
  return [item.businessUnitId || '', item.departmentId, item.costCenterId].join(
    '|'
  )
}

export function isDestinationItem(
  item: Pick<DraftBudgetItem, 'moneyGroup' | 'destinationName'>
) {
  return Boolean(item.moneyGroup && item.destinationName.trim())
}

export function lineTotal(item: DraftBudgetItem, months: BudgetMonth[]) {
  return roundMoney(sum(months.map((month) => item.amounts[month.key] ?? 0)))
}

export function monthTotal(
  items: DraftBudgetItem[],
  monthKey: string
) {
  return roundMoney(sum(items.map((item) => item.amounts[monthKey] ?? 0)))
}

export function grandTotal(items: DraftBudgetItem[], months: BudgetMonth[]) {
  return roundMoney(sum(items.map((item) => lineTotal(item, months))))
}

export function groupItems(
  items: DraftBudgetItem[],
  moneyGroup: MoneyGroup
) {
  return items.filter((item) => item.moneyGroup === moneyGroup)
}

export function groupAllocatedTotal(
  items: DraftBudgetItem[],
  moneyGroup: MoneyGroup,
  months: BudgetMonth[]
) {
  return grandTotal(groupItems(items, moneyGroup), months)
}

export function groupRemaining(
  draft: Pick<DraftBudget, 'groupTotals' | 'items'>,
  moneyGroup: MoneyGroup,
  months: BudgetMonth[]
) {
  const planned =
    draft.groupTotals.find((group) => group.moneyGroup === moneyGroup)?.total ?? 0
  return roundMoney(planned - groupAllocatedTotal(draft.items, moneyGroup, months))
}

export function remapAmounts(
  amounts: Record<string, number>,
  months: BudgetMonth[]
): Record<string, number> {
  return Object.fromEntries(
    months.map((month) => [month.key, roundMoney(amounts[month.key] ?? 0)])
  )
}

export function copyValueToAllMonths(
  _amounts: Record<string, number>,
  months: BudgetMonth[],
  value: number
) {
  const next = roundMoney(value)
  return Object.fromEntries(months.map((month) => [month.key, next]))
}

export function copyPreviousMonths(
  amounts: Record<string, number>,
  months: BudgetMonth[]
) {
  const next = { ...amounts }
  for (let index = 1; index < months.length; index += 1) {
    next[months[index].key] = roundMoney(next[months[index - 1].key] ?? 0)
  }
  return next
}

export function clearAmounts(months: BudgetMonth[]) {
  return emptyAmounts(months)
}

export function distributeAmounts(total: number, months: BudgetMonth[]) {
  const parts = distributeEqually(total, months.length)
  return Object.fromEntries(months.map((month, index) => [month.key, parts[index] ?? 0]))
}

export function applyPercentToAmounts(
  amounts: Record<string, number>,
  months: BudgetMonth[],
  percent: number
) {
  return Object.fromEntries(
    months.map((month) => [
      month.key,
      applyPercent(amounts[month.key] ?? 0, percent),
    ])
  )
}

export function duplicateItem(
  item: DraftBudgetItem,
  months: BudgetMonth[]
): DraftBudgetItem {
  return {
    ...item,
    localId: newLocalId(),
    amounts: remapAmounts(item.amounts, months),
    accounts: (item.accounts ?? []).map((account) => ({
      ...account,
      localId: newLocalId(),
      amounts: remapAmounts(account.amounts, months),
    })),
  }
}

export const BUDGET_STATUS_LABEL: Record<BudgetStatus, string> = {
  draft: 'Rascunho',
  active: 'Ativo',
  archived: 'Arquivado',
}

export function createEmptyItem(
  months: BudgetMonth[],
  businessUnitId = '',
  moneyGroup: MoneyGroup | '' = ''
): DraftBudgetItem {
  return {
    localId: newLocalId(),
    moneyGroup,
    destinationName: '',
    businessUnitId,
    departmentId: '',
    costCenterId: '',
    isDetailed: false,
    accounts: [],
    amounts: emptyAmounts(months),
  }
}

export function createDestinationItem(
  months: BudgetMonth[],
  moneyGroup: MoneyGroup,
  name: string,
  total: number
): DraftBudgetItem {
  return {
    localId: newLocalId(),
    moneyGroup,
    destinationName: name.trim().toLocaleUpperCase('pt-BR'),
    businessUnitId: '',
    departmentId: '',
    costCenterId: '',
    isDetailed: false,
    accounts: [],
    amounts: distributeAmounts(total, months),
  }
}

export function createBudgetAccount(
  months: BudgetMonth[],
  accountCode: string,
  accountName: string,
  total: number,
  ledgerAccountId?: string
): DraftBudgetAccount {
  return {
    localId: newLocalId(),
    ledgerAccountId,
    accountCode: accountCode.trim(),
    accountName: accountName.trim(),
    amounts: distributeAmounts(total, months),
  }
}

export function accountLineTotal(
  account: DraftBudgetAccount,
  months: BudgetMonth[]
) {
  return roundMoney(sum(months.map((month) => account.amounts[month.key] ?? 0)))
}

export function accountsAllocatedTotal(
  item: Pick<DraftBudgetItem, 'accounts'>,
  months: BudgetMonth[]
) {
  return roundMoney(
    sum((item.accounts ?? []).map((account) => accountLineTotal(account, months)))
  )
}

export function accountsRemaining(
  item: DraftBudgetItem,
  months: BudgetMonth[]
) {
  return roundMoney(lineTotal(item, months) - accountsAllocatedTotal(item, months))
}

export function itemIsDetailed(item: Pick<DraftBudgetItem, 'isDetailed' | 'accounts'>) {
  return Boolean(item.isDetailed) || (item.accounts?.length ?? 0) > 0
}

export function itemDisplayName(item: DraftBudgetItem) {
  if (isDestinationItem(item)) return item.destinationName.trim()
  return ''
}

export function itemGroupLabel(item: DraftBudgetItem) {
  if (!item.moneyGroup) return ''
  return MONEY_GROUP_LABEL[item.moneyGroup]
}
