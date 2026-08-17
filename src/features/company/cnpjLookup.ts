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

  if (
    /agric|pecu[aá]r|lavoura|soja|cana|gado|agro|horticult|silvicult/.test(text)
  ) {
    return 'agro'
  }
  if (/com[eé]rcio|varej|atacad|loja|supermerc/.test(text)) {
    return 'commerce'
  }
  if (/ind[uú]str|fabrica|manufatur|metalurg/.test(text)) {
    return 'industry'
  }
  if (/servi[cç]o|consultor|tecnolog|educa|sa[uú]de/.test(text)) {
    return 'services'
  }

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
