import {
  DEFAULT_COST_CENTER_NAMES,
  DEFAULT_DEPARTMENTS,
} from './defaultDepartments.ts'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

assert(
  DEFAULT_COST_CENTER_NAMES.length === DEFAULT_DEPARTMENTS.length,
  'cada departamento padrão deve ter um centro sugerido'
)

assert(
  DEFAULT_COST_CENTER_NAMES.every((name) => name.trim().length > 0),
  'sugestões não podem ter nomes vazios'
)

assert(
  new Set(DEFAULT_COST_CENTER_NAMES.map((name) => name.toLowerCase())).size ===
    DEFAULT_COST_CENTER_NAMES.length,
  'sugestões de centro de custo devem ser únicas'
)

assert(
  DEFAULT_COST_CENTER_NAMES.includes('Administração Geral'),
  'sugestões devem incluir Administração Geral'
)

console.log('costCenterSuggestions.test.ts: ok')
