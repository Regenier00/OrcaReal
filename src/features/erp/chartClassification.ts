import type { MoneyGroup } from '@/types/database'

export type ChartMatchKind = 'exact' | 'prefix'

export interface ChartAccountLike {
  account_code: string
  account_name?: string | null
  match_kind: ChartMatchKind
  money_group: MoneyGroup
  priority?: number
  is_active?: boolean
}

export interface ChartMatch {
  moneyGroup: MoneyGroup
  matchedCode: string
  matchKind: ChartMatchKind
  source: 'chart' | 'prefix'
}

function normCode(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

/** Destino = centro de custo do arquivo realizado. */
export function destinationFromCostCenter(input: {
  costCenterName?: string | null
  costCenterCode?: string | null
  accountName?: string | null
  fallback?: string
}): string {
  const name = String(input.costCenterName ?? '').trim()
  if (name) return name
  const code = String(input.costCenterCode ?? '').trim()
  if (code) return code
  const account = String(input.accountName ?? '').trim()
  if (account) return account
  return input.fallback?.trim() || 'Sem centro de custo'
}

/**
 * Prefixo (ou código exato) → grupo.
 * Destino não vem daqui: usar destinationFromCostCenter.
 */
export function matchChartAccount(
  accountCode: string | null | undefined,
  accounts: ChartAccountLike[],
): ChartMatch | null {
  const code = normCode(accountCode)
  if (!code) return null

  const active = accounts.filter((item) => item.is_active !== false)

  const exact = active.find(
    (item) =>
      item.match_kind === 'exact' && normCode(item.account_code) === code,
  )
  if (exact) {
    return {
      moneyGroup: exact.money_group,
      matchedCode: exact.account_code,
      matchKind: 'exact',
      source: 'chart',
    }
  }

  const prefixes = active
    .filter((item) => item.match_kind === 'prefix')
    .map((item) => ({
      item,
      prefix: normCode(item.account_code),
    }))
    .filter(({ prefix }) => prefix.length > 0 && code.startsWith(prefix))
    .sort((a, b) => {
      if (b.prefix.length !== a.prefix.length) {
        return b.prefix.length - a.prefix.length
      }
      return (a.item.priority ?? 100) - (b.item.priority ?? 100)
    })

  const best = prefixes[0]
  if (!best) return null

  return {
    moneyGroup: best.item.money_group,
    matchedCode: best.item.account_code,
    matchKind: 'prefix',
    source: 'prefix',
  }
}
