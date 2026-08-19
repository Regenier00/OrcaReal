import {
  completeTour,
  getTourStatus,
  markTourPending,
  reopenTour,
  shouldAutoStartTour,
  SKIP_TOUR_LABEL,
  skipTour,
  tourStorageKey,
} from './storage.ts'
import { mergeCollectedFormulas, TOUR_STEPS } from './steps.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const memory = new Map<string, string>()
const storage = {
  getItem(key: string) {
    return memory.get(key) ?? null
  },
  setItem(key: string, value: string) {
    memory.set(key, value)
  },
  removeItem(key: string) {
    memory.delete(key)
  },
  clear() {
    memory.clear()
  },
  key() {
    return null
  },
  get length() {
    return memory.size
  },
}

Object.defineProperty(globalThis, 'localStorage', {
  value: storage,
  configurable: true,
})

memory.clear()
assert(getTourStatus('c1') === null, 'começa sem status')
assert(shouldAutoStartTour('c1') === false, 'sem pending não inicia sozinho')

markTourPending('c1')
assert(getTourStatus('c1') === 'pending', 'marca pendente depois do cadastro')
assert(shouldAutoStartTour('c1') === true, 'pending inicia o tour no dashboard')
assert(
  tourStorageKey('c1') === 'orcareal.platformTour.c1',
  'chave isolada por empresa'
)

markTourPending('c1')
assert(getTourStatus('c1') === 'pending', 'pending de novo não apaga o estado')

skipTour('c1')
assert(getTourStatus('c1') === 'skipped', 'pular grava skipped')
assert(shouldAutoStartTour('c1') === false, 'depois de pular não reabre sozinho')
markTourPending('c1')
assert(getTourStatus('c1') === 'skipped', 'pending não sobrescreve skip')

completeTour('c2')
assert(getTourStatus('c2') === 'completed', 'concluir grava completed')
markTourPending('c2')
assert(getTourStatus('c2') === 'completed', 'pending não sobrescreve completed')

reopenTour('c2')
assert(getTourStatus('c2') === 'pending', 'reabrir volta para pending')
assert(shouldAutoStartTour('c2') === true, 'reabrir permite o tour de novo')

assert(
  SKIP_TOUR_LABEL === 'Já sei usar a plataforma',
  'rótulo de pular fica visível e literal'
)
assert(TOUR_STEPS.length >= 5, 'tour cobre as funcionalidades principais')
assert(
  TOUR_STEPS.some((step) => step.id === 'indicators' && (step.formulas?.length ?? 0) > 0),
  'passo dos indicadores traz fórmula'
)
assert(
  TOUR_STEPS.some((step) => (step.highlights?.length ?? 0) >= 4),
  'atalhos e menu listam as funcionalidades'
)

const merged = mergeCollectedFormulas(
  [{ name: 'Total realizado', formula: 'custos + despesas do mês' }],
  [
    { name: 'Ticket médio', formula: 'receita / vendas' },
    { name: 'Total realizado', formula: 'custos + despesas do mês' },
  ]
)
assert(merged.length === 2, 'junta fórmulas ao vivo com o fallback, sem duplicar')
assert(merged[0]?.name === 'Ticket médio', 'prioriza o que está na tela')

console.log('tour storage tests ok')
