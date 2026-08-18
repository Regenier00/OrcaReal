import {
  dayGreeting,
  greetingFirstName,
  monthResultGreeting,
} from './greeting.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

assert(greetingFirstName('Maria Silva') === 'Maria', 'usa o primeiro nome')
assert(greetingFirstName('  João  ') === 'João', 'ignora espaços extra')
assert(greetingFirstName('', 'ana@empresa.com') === 'ana', 'cai no e-mail sem nome')
assert(greetingFirstName(null, null) === '', 'sem nome e sem e-mail fica vazio')

assert(
  dayGreeting(new Date('2026-08-18T10:00:00-03:00')) === 'Bom dia',
  'manhã em São Paulo é bom dia'
)
assert(
  dayGreeting(new Date('2026-08-18T15:00:00-03:00')) === 'Boa tarde',
  'tarde em São Paulo é boa tarde'
)
assert(
  dayGreeting(new Date('2026-08-18T20:00:00-03:00')) === 'Boa noite',
  'noite em São Paulo é boa noite'
)

assert(
  monthResultGreeting('Maria Silva', null, new Date('2026-08-18T08:00:00-03:00')) ===
    'Bom dia Maria, veja como está o resultado financeiro no mês.',
  'monta a saudação com o primeiro nome'
)
assert(
  monthResultGreeting('', null, new Date('2026-08-18T08:00:00-03:00')) ===
    'Bom dia, veja como está o resultado financeiro no mês.',
  'saudação sem nome quando não há cadastro'
)

console.log('greeting tests ok')
