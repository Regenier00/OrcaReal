import type { MoneyGroup } from '../../types/database.ts'
import { productsFromFacts } from '../budget/defaultDestinations.ts'

export interface BudgetDestinationRef {
  id: string
  moneyGroup: MoneyGroup
  name: string
}

export interface DestinationMatchPattern {
  matchType: 'counterparty' | 'description_contains' | 'description_exact'
  matchValue: string
  moneyGroup: MoneyGroup
  destinationId: string | null
  destinationName: string
  usageCount: number
}

export interface ClassificationSuggestionContext {
  destinations: BudgetDestinationRef[]
  patterns: DestinationMatchPattern[]
  profileFacts?: Record<string, unknown>
  segmentCode?: string | null
}

export interface TransactionSuggestionInput {
  id: string
  description: string
  counterparty?: string | null
  type?: string | null
  suggested_money_group?: MoneyGroup | null
  suggested_destination_id?: string | null
  suggested_destination_name?: string | null
  suggestion_source?: 'history' | 'rule' | null
}

export interface EnrichedSuggestion {
  moneyGroup: MoneyGroup | null
  destinationId: string | null
  destinationName: string | null
  source: 'history' | 'rule' | 'context' | null
  label: string | null
}

const KEYWORD_RULES: Array<{
  patterns: RegExp[]
  moneyGroup: MoneyGroup
  destinationHints: string[]
}> = [
  {
    patterns: [/posto\b/i, /combust/i, /gasolina/i, /diesel/i, /etanol/i],
    moneyGroup: 'cost',
    destinationHints: ['Combustível', 'Combustivel'],
  },
  {
    patterns: [/energia/i, /eletric/i, /cemig/i, /enel/i, /light\b/i, /copel/i],
    moneyGroup: 'expense',
    destinationHints: ['Energia'],
  },
  {
    patterns: [/internet/i, /telecom/i, /vivo\b/i, /claro\b/i, /tim\b/i, /oi\b/i],
    moneyGroup: 'expense',
    destinationHints: ['Internet'],
  },
  {
    patterns: [/aluguel/i, /locação/i, /locacao/i],
    moneyGroup: 'expense',
    destinationHints: ['Aluguel'],
  },
  {
    patterns: [/contab/i, /contador/i],
    moneyGroup: 'expense',
    destinationHints: ['Contabilidade'],
  },
  {
    patterns: [/marketing/i, /google ads/i, /meta ads/i, /facebook ads/i, /anuncio/i, /anúncio/i],
    moneyGroup: 'expense',
    destinationHints: ['Marketing'],
  },
  {
    patterns: [/frete/i, /transportadora/i, /correios/i, /jadlog/i, /melhor envio/i],
    moneyGroup: 'cost',
    destinationHints: ['Fretes', 'Frete'],
  },
  {
    patterns: [/folha\b/i, /salario/i, /salário/i, /inss\b/i, /fgts\b/i],
    moneyGroup: 'cost',
    destinationHints: ['Mão de obra', 'Folha da operação', 'Folha administrativa'],
  },
  {
    patterns: [/manuten/i, /oficina/i],
    moneyGroup: 'cost',
    destinationHints: ['Manutenção'],
  },
]

function normalize(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function findDestination(
  destinations: BudgetDestinationRef[],
  moneyGroup: MoneyGroup,
  hints: string[]
): BudgetDestinationRef | null {
  const normalizedHints = hints.map((item) => normalize(item))
  return (
    destinations.find(
      (item) =>
        item.moneyGroup === moneyGroup &&
        normalizedHints.some(
          (hint) =>
            normalize(item.name) === hint || normalize(item.name).includes(hint)
        )
    ) ?? null
  )
}

function matchPattern(
  patterns: DestinationMatchPattern[],
  description: string,
  counterparty: string | null | undefined
): DestinationMatchPattern | null {
  const desc = normalize(description)
  const party = normalize(counterparty)

  const exactDesc = patterns
    .filter((item) => item.matchType === 'description_exact' && item.matchValue === desc)
    .sort((a, b) => b.usageCount - a.usageCount)[0]
  if (exactDesc) return exactDesc

  if (party) {
    const byParty = patterns
      .filter((item) => item.matchType === 'counterparty' && item.matchValue === party)
      .sort((a, b) => b.usageCount - a.usageCount)[0]
    if (byParty) return byParty
  }

  const contains = patterns
    .filter(
      (item) =>
        item.matchType === 'description_contains' &&
        item.matchValue &&
        desc.includes(item.matchValue)
    )
    .sort((a, b) => b.usageCount - a.usageCount)[0]
  return contains ?? null
}

function contextSuggestion(
  input: TransactionSuggestionInput,
  context: ClassificationSuggestionContext
): EnrichedSuggestion | null {
  const haystack = `${input.description} ${input.counterparty ?? ''}`
  const normalized = normalize(haystack)

  for (const rule of KEYWORD_RULES) {
    if (!rule.patterns.some((pattern) => pattern.test(haystack))) continue
    const destination = findDestination(
      context.destinations,
      rule.moneyGroup,
      rule.destinationHints
    )
    return {
      moneyGroup: rule.moneyGroup,
      destinationId: destination?.id ?? null,
      destinationName: destination?.name ?? rule.destinationHints[0] ?? null,
      source: 'context',
      label: destination
        ? `${labelForGroup(rule.moneyGroup)} › ${destination.name}`
        : `${labelForGroup(rule.moneyGroup)} › ${rule.destinationHints[0]}`,
    }
  }

  // Produtos/serviços do cadastro → receita
  const products = productsFromFacts(context.profileFacts ?? {})
  for (const product of products) {
    const productKey = normalize(product)
    if (productKey.length < 3) continue
    if (!normalized.includes(productKey)) continue
    const destination = findDestination(context.destinations, 'revenue', [
      product,
      `Venda de ${product}`,
      `Serviços · ${product}`,
    ])
    return {
      moneyGroup: 'revenue',
      destinationId: destination?.id ?? null,
      destinationName: destination?.name ?? `Venda de ${product}`,
      source: 'context',
      label: destination
        ? `Receitas › ${destination.name}`
        : `Receitas › Venda de ${product}`,
    }
  }

  // Destinos do orçamento cujo nome aparece na descrição
  const ranked = context.destinations
    .map((destination) => {
      const nameKey = normalize(destination.name)
      if (nameKey.length < 3) return null
      if (!normalized.includes(nameKey)) return null
      return destination
    })
    .filter((item): item is BudgetDestinationRef => Boolean(item))
    .sort((a, b) => normalize(b.name).length - normalize(a.name).length)

  const hit = ranked[0]
  if (!hit) return null
  return {
    moneyGroup: hit.moneyGroup,
    destinationId: hit.id,
    destinationName: hit.name,
    source: 'context',
    label: `${labelForGroup(hit.moneyGroup)} › ${hit.name}`,
  }
}

function labelForGroup(moneyGroup: MoneyGroup) {
  if (moneyGroup === 'revenue') return 'Receitas'
  if (moneyGroup === 'cost') return 'Custos'
  if (moneyGroup === 'expense') return 'Despesas'
  return 'Investimentos'
}

/**
 * Enriquece sugestões: histórico confirmado > padrões aprendidos > contexto da empresa/orçamento.
 */
export function enrichTransactionSuggestion(
  input: TransactionSuggestionInput,
  context: ClassificationSuggestionContext
): EnrichedSuggestion {
  if (input.suggested_money_group || input.suggested_destination_name) {
    const moneyGroup = input.suggested_money_group
    const destinationName = input.suggested_destination_name
    return {
      moneyGroup: moneyGroup ?? null,
      destinationId: input.suggested_destination_id ?? null,
      destinationName: destinationName ?? null,
      source: input.suggestion_source ?? 'history',
      label:
        moneyGroup && destinationName
          ? `${labelForGroup(moneyGroup)} › ${destinationName}`
          : moneyGroup
            ? labelForGroup(moneyGroup)
            : destinationName ?? null,
    }
  }

  const patterned = matchPattern(context.patterns, input.description, input.counterparty)
  if (patterned) {
    return {
      moneyGroup: patterned.moneyGroup,
      destinationId: patterned.destinationId,
      destinationName: patterned.destinationName,
      source: 'history',
      label: `${labelForGroup(patterned.moneyGroup)} › ${patterned.destinationName}`,
    }
  }

  const fromContext = contextSuggestion(input, context)
  if (fromContext) return fromContext

  return {
    moneyGroup: null,
    destinationId: null,
    destinationName: null,
    source: null,
    label: null,
  }
}

export function hasDestinationSuggestion(item: {
  suggested_money_group?: string | null
  suggested_destination_name?: string | null
  suggested_category_id?: string | null
  suggested_department_id?: string | null
  suggested_cost_center_id?: string | null
}) {
  return Boolean(
    item.suggested_money_group ||
      item.suggested_destination_name ||
      item.suggested_category_id ||
      item.suggested_department_id ||
      item.suggested_cost_center_id
  )
}
