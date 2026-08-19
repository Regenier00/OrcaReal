import {
  brandColorContrastWarning,
  deriveBrandTokens,
  ORCAREAL_BRAND_COLOR,
  parseBrandColor,
  resolveBrandColor,
} from './brandColor.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

assert(parseBrandColor('#AA00FF') === '#aa00ff', 'normaliza hex de 6 dígitos')
assert(parseBrandColor('#abc') === '#aabbcc', 'expande hex de 3 dígitos')
assert(parseBrandColor('  #97f7a1  ') === '#97f7a1', 'ignora espaços')
assert(parseBrandColor('#gg0000') === null, 'rejeita hex inválido')
assert(parseBrandColor('aa00ff') === null, 'exige #')
assert(parseBrandColor(null) === null, 'null não é cor')

assert(
  resolveBrandColor(null) === ORCAREAL_BRAND_COLOR,
  'sem cor usa o roxo do OrcaReal'
)
assert(
  resolveBrandColor('#123') === '#112233',
  'resolve a cor informada quando ela é válida'
)

const tokens = deriveBrandTokens('#aa00ff')
assert(tokens.brand === '#aa00ff', 'token principal replica a cor')
assert(tokens.brandHover !== tokens.brand, 'hover é um tom mais escuro')
assert(tokens.brandSoft !== tokens.brand, 'soft é um tom mais claro')

assert(
  brandColorContrastWarning('#ffffff') != null,
  'branco em botão gera aviso de contraste'
)
assert(
  brandColorContrastWarning(ORCAREAL_BRAND_COLOR) == null,
  'roxo do OrcaReal não precisa de aviso'
)

console.log('brandColor tests ok')
