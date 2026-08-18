import { isValidCnpj } from './cnpj.ts'
import {
  BRASIL_API_CNPJ_URL,
  lookupCnpj,
  mapBrasilApiCnpj,
} from './cnpjLookup.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const casasBahiaCnpj = '33.041.260/0652-90'

assert(isValidCnpj(casasBahiaCnpj), 'CNPJ das Casas Bahia é válido')
assert(
  BRASIL_API_CNPJ_URL === 'https://brasilapi.com.br/api/cnpj/v1',
  'usa o prefixo /api da BrasilAPI'
)

const mapped = mapBrasilApiCnpj({
  cnpj: '33041260065290',
  razao_social: 'GRUPO CASAS BAHIA S.A.',
  nome_fantasia: '',
  cnae_fiscal_descricao:
    'Comércio varejista especializado de eletrodomésticos e equipamentos de áudio e vídeo',
  descricao_situacao_cadastral: 'ATIVA',
  uf: 'SP',
  municipio: 'SAO PAULO',
})

assert(mapped.legalName === 'GRUPO CASAS BAHIA S.A.', 'preenche a razão social')
assert(mapped.tradeName === '', 'nome fantasia vazio fica vazio')
assert(mapped.status === 'ATIVA', 'situação cadastral')
assert(mapped.suggestedSegment === 'commerce', 'CNAE varejista sugere comércio')
assert(mapped.state === 'SP', 'UF')
assert(mapped.city === 'SAO PAULO', 'município')

const originalFetch = globalThis.fetch

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

try {
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    assert(
      url === `${BRASIL_API_CNPJ_URL}/33041260065290`,
      `consulta o CNPJ na URL correta: ${url}`
    )
    const headers = new Headers(init?.headers)
    assert(headers.get('Accept') === 'application/json', 'pede JSON')
    return jsonResponse({
      cnpj: '33041260065290',
      razao_social: 'GRUPO CASAS BAHIA S.A.',
      cnae_fiscal_descricao:
        'Comércio varejista especializado de eletrodomésticos e equipamentos de áudio e vídeo',
      descricao_situacao_cadastral: 'ATIVA',
      uf: 'SP',
      municipio: 'SAO PAULO',
    })
  }

  const result = await lookupCnpj(casasBahiaCnpj)
  assert(result.legalName === 'GRUPO CASAS BAHIA S.A.', 'lookup preenche Casas Bahia')
  assert(result.suggestedSegment === 'commerce', 'lookup sugere comércio')

  globalThis.fetch = async () =>
    new Response('<html>404</html>', {
      status: 404,
      headers: { 'content-type': 'text/html' },
    })

  try {
    await lookupCnpj(casasBahiaCnpj)
    throw new Error('HTML 404 deveria falhar a consulta')
  } catch (error) {
    assert(
      error instanceof Error && error.message === 'CNPJ_LOOKUP_FAILED',
      '404 HTML não é tratado como CNPJ inexistente'
    )
  }

  globalThis.fetch = async () => jsonResponse({ message: 'CNPJ not found' }, 404)

  try {
    await lookupCnpj('00000000000191')
    throw new Error('404 JSON deveria ser CNPJ_NOT_FOUND')
  } catch (error) {
    assert(
      error instanceof Error && error.message === 'CNPJ_NOT_FOUND',
      '404 JSON da BrasilAPI é CNPJ não encontrado'
    )
  }
} finally {
  globalThis.fetch = originalFetch
}

console.log('cnpj lookup tests ok')
