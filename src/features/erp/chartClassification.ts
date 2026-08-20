import type { MoneyGroup } from '@/types/database'

function normalizeToken(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export type ChartMatchKind = 'exact' | 'prefix'

export interface ChartAccountLike {
  account_code: string
  account_name?: string | null
  match_kind: ChartMatchKind
  money_group: MoneyGroup
  destination_id?: string | null
  destination_name: string
  priority?: number
  is_active?: boolean
}

export interface ChartSuggestion {
  moneyGroup: MoneyGroup
  destinationId: string | null
  destinationName: string
  source: 'chart' | 'prefix' | 'heuristic'
  matchedCode: string
  matchKind: ChartMatchKind | 'heuristic'
}

function normCode(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

/**
 * Lookup determinístico (sem IA):
 * 1) código exato no plano → apropriação automática
 * 2) prefixo mais longo → sugestão
 * 3) null → deixa heurística/descrição para o caller
 */
export function matchChartAccount(
  accountCode: string | null | undefined,
  accounts: ChartAccountLike[],
): ChartSuggestion | null {
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
      destinationId: exact.destination_id ?? null,
      destinationName: exact.destination_name,
      source: 'chart',
      matchedCode: exact.account_code,
      matchKind: 'exact',
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
    destinationId: best.item.destination_id ?? null,
    destinationName: best.item.destination_name,
    source: 'prefix',
    matchedCode: best.item.account_code,
    matchKind: 'prefix',
  }
}

/** Sugestão por descrição quando não há código mapeado. */
export function suggestGroupFromDescription(
  description: string | null | undefined,
  accountName?: string | null,
): { moneyGroup: MoneyGroup; destinationName: string } | null {
  const blob = normalizeToken(
    [accountName, description].filter(Boolean).join(' '),
  )
  if (!blob) return null

  if (/\b(receita|faturamento|venda|vendas|recebimento)\b/.test(blob)) {
    return { moneyGroup: 'revenue', destinationName: 'Receitas operacionais' }
  }
  if (
    /\b(cmv|cpv|csv|custo da mercadoria|custo do produto|custo direto)\b/.test(
      blob,
    )
  ) {
    return { moneyGroup: 'cost', destinationName: 'Custos operacionais' }
  }
  if (
    /\b(investimento|imobilizado|capex|maquina|equipamento)\b/.test(blob)
  ) {
    return { moneyGroup: 'investment', destinationName: 'Investimentos' }
  }
  if (
    /\b(despesa|salario|aluguel|energia|marketing|administrativ|imposto)\b/.test(
      blob,
    )
  ) {
    return { moneyGroup: 'expense', destinationName: 'Despesas operacionais' }
  }
  return null
}

export const DEFAULT_CHART_PREFIXES: ReadonlyArray<{
  accountCode: string
  accountName: string
  moneyGroup: MoneyGroup
  destinationName: string
  priority: number
}> = [
  {
    accountCode: '3',
    accountName: 'Grupo Receita (prefixo)',
    moneyGroup: 'revenue',
    destinationName: 'Receitas operacionais',
    priority: 90,
  },
  {
    accountCode: '4.1',
    accountName: 'Grupo Custo (prefixo)',
    moneyGroup: 'cost',
    destinationName: 'Custos operacionais',
    priority: 10,
  },
  {
    accountCode: '4.2',
    accountName: 'Grupo Despesa (prefixo)',
    moneyGroup: 'expense',
    destinationName: 'Despesas operacionais',
    priority: 10,
  },
  {
    accountCode: '4',
    accountName: 'Grupo Despesa (prefixo)',
    moneyGroup: 'expense',
    destinationName: 'Despesas operacionais',
    priority: 90,
  },
  {
    accountCode: '1.2',
    accountName: 'Grupo Investimento (prefixo)',
    moneyGroup: 'investment',
    destinationName: 'Investimentos',
    priority: 40,
  },
  {
    accountCode: '1.3',
    accountName: 'Grupo Investimento (prefixo)',
    moneyGroup: 'investment',
    destinationName: 'Investimentos',
    priority: 40,
  },
] as const
