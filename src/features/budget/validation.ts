import type {
  DraftBudget,
  DraftBudgetItem,
  MoneyGroup,
} from '@/features/budget/model'
import {
  groupAllocatedTotal,
  groupItems,
  itemIsDetailed,
  MONEY_GROUP_LABEL,
  structureKey,
} from '@/features/budget/model'
import { monthsBetween } from '@/features/budget/period'
import { roundMoney } from '@/features/budget/money'

export function validateBudgetMeta(draft: DraftBudget): string[] {
  const errors: string[] = []

  if (!draft.name.trim()) {
    errors.push('Informe o nome do orçamento.')
  }

  if (!Number.isInteger(draft.fiscalYear) || draft.fiscalYear < 2000 || draft.fiscalYear > 2100) {
    errors.push('Informe um ano/período válido.')
  }

  if (!draft.periodLabel.trim()) {
    errors.push('Informe o rótulo do período (ex.: 2026/2027).')
  }

  if (!draft.startDate || !draft.endDate) {
    errors.push('Informe a data inicial e a data final.')
  } else if (draft.endDate < draft.startDate) {
    errors.push('A data final deve ser igual ou posterior à data inicial.')
  }

  const months = monthsBetween(draft.startDate, draft.endDate)
  if (draft.startDate && draft.endDate && months.length === 0) {
    errors.push('O período informado não contém meses válidos.')
  }

  return errors
}

export function validateGroupTotals(draft: DraftBudget): string[] {
  const errors: string[] = []
  const enabled = draft.groupTotals.filter((group) => group.total > 0)
  if (enabled.length === 0) {
    errors.push('Informe ao menos um valor em Receitas, Custos, Despesas ou Investimentos.')
  }
  for (const group of draft.groupTotals) {
    if (!Number.isFinite(group.total) || group.total < 0) {
      errors.push(`Valor inválido em ${MONEY_GROUP_LABEL[group.moneyGroup]}.`)
    }
  }
  return errors
}

export function validateBudgetItem(item: DraftBudgetItem): string[] {
  const errors: string[] = []

  if (item.moneyGroup) {
    if (!item.destinationName.trim()) {
      errors.push('Informe o nome do destino.')
    }
  } else {
    if (!item.departmentId) errors.push('Selecione o departamento.')
    if (!item.costCenterId) errors.push('Selecione o centro de custo.')
  }

  for (const [key, amount] of Object.entries(item.amounts)) {
    if (!Number.isFinite(amount)) {
      errors.push(`Valor inválido no mês ${key}.`)
      break
    }
    if (amount < 0) {
      errors.push('Valores negativos não são permitidos.')
      break
    }
  }

  // UX: o backend é a fonte da verdade e rejeita soma inconsistente.
  if (itemIsDetailed(item)) {
    const accounts = item.accounts ?? []
    if (accounts.length === 0) {
      errors.push('Orçamento detalhado exige ao menos uma conta contábil.')
    }
    const seen = new Set<string>()
    for (const account of accounts) {
      if (!account.accountCode.trim() || !account.accountName.trim()) {
        errors.push('Cada conta detalhada precisa de número e descrição.')
        break
      }
      const codeKey = account.accountCode.trim().toLowerCase()
      if (seen.has(codeKey)) {
        errors.push(`A conta ${account.accountCode} está duplicada neste destino.`)
        break
      }
      seen.add(codeKey)
    }

    const monthKeys = Object.keys(item.amounts)
    if (monthKeys.length > 0) {
      const allocated = roundMoney(
        accounts.reduce((sum, account) => {
          const accountTotal = monthKeys.reduce(
            (inner, key) => inner + (account.amounts[key] ?? 0),
            0
          )
          return sum + accountTotal
        }, 0)
      )
      const total = roundMoney(
        monthKeys.reduce((sum, key) => sum + (item.amounts[key] ?? 0), 0)
      )
      if (allocated !== total) {
        errors.push(
          `A soma das contas (${allocated.toFixed(2)}) deve ser igual ao total do destino (${total.toFixed(2)}).`
        )
      }
    }
  }

  return errors
}

/** @deprecated Prefer validateBudgetItem without structure for destination budgets. */
export function validateBudgetItemLegacy(
  item: DraftBudgetItem,
  options?: { requireBusinessUnit?: boolean; hasBusinessUnits?: boolean }
): string[] {
  const errors = validateBudgetItem(item)
  const requireBusinessUnit =
    options?.requireBusinessUnit ?? Boolean(options?.hasBusinessUnits)
  if (!item.moneyGroup && requireBusinessUnit && !item.businessUnitId) {
    errors.push('Selecione a unidade de negócio.')
  }
  return errors
}

export function findDuplicateStructure(
  items: DraftBudgetItem[],
  candidate: DraftBudgetItem,
  ignoreLocalId?: string
) {
  const key = structureKey(candidate)
  return items.find(
    (item) => item.localId !== ignoreLocalId && structureKey(item) === key
  )
}

export function validateGroupDestinations(
  draft: DraftBudget,
  moneyGroup: MoneyGroup
): string[] {
  const errors: string[] = []
  const months = monthsBetween(draft.startDate, draft.endDate)
  const planned =
    draft.groupTotals.find((group) => group.moneyGroup === moneyGroup)?.total ?? 0
  const items = groupItems(draft.items, moneyGroup)

  if (planned <= 0) return errors

  if (items.length === 0) {
    errors.push(
      `Crie ao menos um destino em ${MONEY_GROUP_LABEL[moneyGroup]} ou zere o valor do grupo.`
    )
    return errors
  }

  items.forEach((item, index) => {
    for (const error of validateBudgetItem(item)) {
      errors.push(`${MONEY_GROUP_LABEL[moneyGroup]} · destino ${index + 1}: ${error}`)
    }
  })

  const seen = new Set<string>()
  for (const item of items) {
    const key = structureKey(item)
    if (seen.has(key)) {
      errors.push(
        `O destino “${item.destinationName.trim()}” está duplicado em ${MONEY_GROUP_LABEL[moneyGroup]}.`
      )
    }
    seen.add(key)
  }

  const allocated = groupAllocatedTotal(draft.items, moneyGroup, months)
  if (roundMoney(allocated) !== roundMoney(planned)) {
    errors.push(
      `Em ${MONEY_GROUP_LABEL[moneyGroup]}, a soma dos destinos (${allocated.toFixed(2)}) precisa fechar o valor do grupo (${planned.toFixed(2)}).`
    )
  }

  return errors
}

export function validateBudgetForSave(draft: DraftBudget) {
  const errors = [
    ...validateBudgetMeta(draft),
    ...validateGroupTotals(draft),
  ]
  const seen = new Set<string>()

  const activeGroups = draft.groupTotals
    .filter((group) => group.total > 0)
    .map((group) => group.moneyGroup)

  for (const moneyGroup of activeGroups) {
    errors.push(...validateGroupDestinations(draft, moneyGroup))
  }

  draft.items.forEach((item, index) => {
    const itemErrors = validateBudgetItem(item)
    for (const error of itemErrors) {
      errors.push(`Linha ${index + 1}: ${error}`)
    }

    const key = structureKey(item)
    if (seen.has(key)) {
      errors.push(`Linha ${index + 1}: este destino já existe neste orçamento.`)
    }
    seen.add(key)
  })

  return errors
}

/** Validação leve para realizado periódico (não exige fechar totais de grupo). */
export function validateActualItemsForSave(draft: DraftBudget) {
  const errors: string[] = []
  const seen = new Set<string>()

  if (draft.items.length === 0) {
    errors.push('Adicione ao menos uma linha no realizado.')
  }

  draft.items.forEach((item, index) => {
    // Realizado periódico não usa detalhamento por conta neste fluxo.
    const basic: DraftBudgetItem = {
      ...item,
      isDetailed: false,
      accounts: [],
    }
    const itemErrors = validateBudgetItem(basic)
    for (const error of itemErrors) {
      errors.push(`Linha ${index + 1}: ${error}`)
    }

    const key = structureKey(item)
    if (seen.has(key)) {
      errors.push(`Linha ${index + 1}: esta combinação já existe neste realizado.`)
    }
    seen.add(key)
  })

  return errors
}
