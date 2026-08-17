import type { CompanyStructure } from '@/features/company/structureService'
import type { DraftBudget, DraftBudgetItem } from '@/features/budget/model'
import { structureKey } from '@/features/budget/model'
import { monthsBetween } from '@/features/budget/period'

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

export function validateBudgetItem(
  item: DraftBudgetItem,
  structure: CompanyStructure,
  options?: { requireBusinessUnit?: boolean }
): string[] {
  const errors: string[] = []
  const requireBusinessUnit =
    options?.requireBusinessUnit ?? structure.businessUnits.length > 0

  if (requireBusinessUnit && !item.businessUnitId) {
    errors.push('Selecione a unidade de negócio.')
  }
  if (!item.departmentId) errors.push('Selecione o departamento.')
  if (!item.costCenterId) errors.push('Selecione o centro de custo.')

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

export function validateBudgetForSave(
  draft: DraftBudget,
  structure: CompanyStructure
) {
  const errors = validateBudgetMeta(draft)
  const requireBusinessUnit = structure.businessUnits.length > 0
  const seen = new Set<string>()

  draft.items.forEach((item, index) => {
    const itemErrors = validateBudgetItem(item, structure, { requireBusinessUnit })
    for (const error of itemErrors) {
      errors.push(`Linha ${index + 1}: ${error}`)
    }

    const key = structureKey(item)
    if (seen.has(key)) {
      errors.push(
        `Linha ${index + 1}: esta combinação de estrutura já existe neste orçamento.`
      )
    }
    seen.add(key)
  })

  return errors
}
