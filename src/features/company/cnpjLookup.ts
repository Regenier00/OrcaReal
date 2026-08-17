import { onlyDigits } from '@/features/company/cnpj'
import type { SegmentCode } from '@/features/company/segmentOptions'

export interface BrasilApiCnpj {
  cnpj: string
  razao_social?: string
  nome_fantasia?: string
  cnae_fiscal_descricao?: string
  descricao_situacao_cadastral?: string
  uf?: string
  municipio?: string
}

export interface CnpjLookupResult {
  legalName: string
  tradeName: string
  description: string
  status: string
  suggestedSegment: SegmentCode | null
}

function suggestSegmentFromCnae(cnae: string): SegmentCode | null {
  const text = cnae.toLowerCase()

  if (/pesca|aquicult|piscicult/.test(text)) return 'fishing'
  if (/pecu[aá]r|gado|avicult|su[ií]n/.test(text)) return 'livestock'
  if (/agric|lavoura|soja|cana|agro|horticult|silvicult/.test(text)) return 'agro'
  if (/constru[cç]|obra|engenharia civil/.test(text)) return 'construction'
  if (/com[eé]rcio|varej|atacad|loja|supermerc/.test(text)) return 'commerce'
  if (/ind[uú]str|fabrica|manufatur|metalurg/.test(text)) return 'industry'
  if (/software|tecnolog|inform[aá]tica|ti\b/.test(text)) return 'tech'
  if (/transport|log[ií]st|armazen/.test(text)) return 'transport_logistics'
  if (/aliment|restaurante|padaria|bar\b|lanchonete/.test(text)) return 'food'
  if (/hotel|turismo|pousada/.test(text)) return 'hospitality'
  if (/sa[uú]de|hospital|cl[ií]nica|m[eé]dic/.test(text)) return 'health'
  if (/educa|escola|faculdade|curso/.test(text)) return 'education'
  if (/im[oó]ve|imobili/.test(text)) return 'real_estate'
  if (/banc|financeir|seguro|cr[eé]dito/.test(text)) return 'financial'
  if (/autom[oó]t|ve[ií]cul|oficina/.test(text)) return 'automotive'
  if (/energia|el[eé]tric|solar/.test(text)) return 'energy'
  if (/mina|minera[cç]/.test(text)) return 'mining'
  if (/r[aá]dio|televis|jornal|m[ií]dia/.test(text)) return 'media'
  if (/publicidade|propaganda|marketing/.test(text)) return 'marketing'
  if (/teatro|cinema|cultura|entretenimento/.test(text)) return 'entertainment'
  if (/esporte|lazer|academia/.test(text)) return 'sports'
  if (/beleza|est[eé]tica|sal[aã]o|cabeleireiro/.test(text)) return 'beauty'
  if (/consultor|advocac|contab[ií]l|auditoria/.test(text)) return 'professional'
  if (/ambiente|ambiental|sustentab/.test(text)) return 'environment'
  if (/administra[cç][aã]o p[uú]blica|prefeitura|autarquia/.test(text)) {
    return 'public_admin'
  }
  if (/servi[cç]o/.test(text)) return 'services'

  return null
}

export async function lookupCnpj(
  cnpj: string,
  signal?: AbortSignal
): Promise<CnpjLookupResult> {
  const digits = onlyDigits(cnpj)
  const response = await fetch(`https://brasilapi.com.br/cnpj/v1/${digits}`, {
    signal,
  })

  if (response.status === 404) {
    throw new Error('CNPJ_NOT_FOUND')
  }

  if (!response.ok) {
    throw new Error('CNPJ_LOOKUP_FAILED')
  }

  const data = (await response.json()) as BrasilApiCnpj
  const cnae = data.cnae_fiscal_descricao?.trim() ?? ''

  return {
    legalName: data.razao_social?.trim() ?? '',
    tradeName: data.nome_fantasia?.trim() ?? '',
    description: cnae,
    status: data.descricao_situacao_cadastral?.trim() ?? '',
    suggestedSegment: cnae ? suggestSegmentFromCnae(cnae) : null,
  }
}
