import {
  OTHER_PRODUCT_OPTION,
  productOptionValue,
  resolveProductLabels,
  searchSectorProductsLocal,
  SECTOR_PRODUCT_CATALOG,
} from './catalog/sectorProducts.ts'
import { QUESTIONS } from './catalog/questions.ts'
import { RETIRED_QUESTION_CODES } from './retiredQuestions.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

assert(SECTOR_PRODUCT_CATALOG.length > 50, 'catálogo local precisa de produtos por ramo')

// Contratos de segurança espelhados no client (defesa em profundidade)
assert(typeof searchSectorProductsLocal === 'function', 'fallback local existe')
const longQuery = 'a'.repeat(200)
const capped = searchSectorProductsLocal(['tech'], longQuery)
assert(Array.isArray(capped), 'query longa não quebra a busca local')

const injection = searchSectorProductsLocal(['commerce'], '%_; DROP TABLE--')
assert(Array.isArray(injection), 'texto malicioso é tratado como literal na busca local')
assert(
  injection.every((item) => item.segmentCode === 'commerce'),
  'payload não altera o filtro de ramo'
)

const agro = searchSectorProductsLocal(['agro'])
assert(agro.some((item) => item.code === 'soja'), 'agro sugere soja')
assert(agro.every((item) => item.segmentCode === 'agro'), 'busca agro não mistura ramos')

const mixed = searchSectorProductsLocal(['commerce', 'food'])
assert(
  mixed.some((item) => item.segmentCode === 'commerce'),
  'outras operações entram na busca'
)
assert(mixed.some((item) => item.segmentCode === 'food'), 'alimentação entra com comércio')

const query = searchSectorProductsLocal(['tech'], 'software sob demanda')
assert(query.length > 0, 'rebusca por descrição encontra produtos')
assert(
  query[0]?.name.toLowerCase().includes('software') ||
    query.some((item) => item.code === 'software_sob_demanda'),
  'descrição prioriza software sob demanda'
)

const emptyQuery = searchSectorProductsLocal(['beauty'], 'xyzprodutoinexistente')
assert(emptyQuery.length === 0, 'sem match a rebusca não inventa produto')

assert(OTHER_PRODUCT_OPTION.value === 'outro', 'opção Outro disponível')

const labels = resolveProductLabels(['commerce:vestuario', 'outro', 'marmitas artesanais'])
assert(labels.includes('Vestuário e calçados'), 'resolve código segment:code')
assert(!labels.includes('outro'), 'ignora Outro')
assert(labels.includes('marmitas artesanais'), 'mantém texto livre')

const productsQuestion = QUESTIONS.find((item) => item.code === 'products_offered')
assert(productsQuestion, 'pergunta products_offered no catálogo')
assert(productsQuestion?.optionSource === 'sector_products', 'products_offered usa busca setorial')

const describeQ = QUESTIONS.find((item) => item.code === 'products_other_describe')
assert(describeQ, 'fluxo Outro pede descrição')
assert(
  describeQ?.showWhen &&
    'includes' in describeQ.showWhen &&
    describeQ.showWhen.includes.value === 'outro',
  'descrição só aparece quando Outro é marcado'
)

const matchesQ = QUESTIONS.find((item) => item.code === 'products_other_matches')
assert(matchesQ?.optionSource === 'sector_products_query', 'rebusca após descrição')

assert(RETIRED_QUESTION_CODES.has('com_products'), 'texto livre de comércio aposentado')
assert(RETIRED_QUESTION_CODES.has('food_products'), 'texto livre de alimentação aposentado')

const commerceOpts = searchSectorProductsLocal(['commerce']).map((item) =>
  productOptionValue(item)
)
assert(commerceOpts.includes('commerce:vestuario'), 'valor de opção usa segment:code')

console.log('sectorProducts search tests ok')
