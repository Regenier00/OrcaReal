import { QUESTIONS } from './catalog/questions.ts'
import { EMPLOYEE_COUNT_QUESTION } from './employeeCount.ts'
import { isRetiredQuestion, RETIRED_QUESTION_CODES } from './retiredQuestions.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const retiredInCatalog = QUESTIONS.filter((question) => RETIRED_QUESTION_CODES.has(question.code))
assert(retiredInCatalog.length === 0, 'catálogo ainda contém perguntas aposentadas')

const numberQuestions = QUESTIONS.filter((question) => question.answerType === 'number')
assert(
  numberQuestions.length === 1 && numberQuestions[0]?.code === EMPLOYEE_COUNT_QUESTION,
  'só a quantidade de funcionários deve ser numérica no cadastro'
)

const exclusiveSingle = new Set(['company_size', 'state', 'operation_model'])
for (const question of QUESTIONS) {
  assert(!isRetiredQuestion(question), `pergunta ativa marcada como aposentada: ${question.code}`)
  const hasChoices = Boolean(question.options?.length) || Boolean(question.optionSource)
  if (!hasChoices) continue
  const yesNo =
    question.options?.length === 2 &&
    question.options.some((option) => option.value === 'yes') &&
    question.options.some((option) => option.value === 'no')
  if (yesNo || exclusiveSingle.has(question.code)) {
    assert(
      question.answerType === 'single',
      `${question.code} deveria continuar como escolha única`
    )
    continue
  }
  assert(
    question.answerType === 'multiple',
    `${question.code} deveria permitir marcar mais de uma opção`
  )
}

const mixedSegments = new Set(['commerce', 'livestock', 'agro'])
const mixed = QUESTIONS.filter(
  (question) => !question.segmentCode || mixedSegments.has(question.segmentCode)
)
const mixedCodes = new Set(mixed.map((question) => question.code))

assert(
  RETIRED_QUESTION_CODES.has('control_method'),
  'control_method deve estar aposentada: não personaliza a experiência'
)
assert(
  !mixedCodes.has('control_method'),
  'cadastro não deve perguntar como a empresa controla as finanças hoje'
)
assert(
  isRetiredQuestion({
    code: 'control_method',
    prompt: 'Como a empresa controla as finanças hoje?',
    answerType: 'single',
    options: [],
    sortOrder: 30,
    segmentCode: null,
  }),
  'wizard deve ignorar control_method mesmo se vier do banco'
)
assert(
  RETIRED_QUESTION_CODES.has('main_objective'),
  'main_objective deve estar aposentada: não personaliza a experiência'
)
assert(
  !mixedCodes.has('main_objective'),
  'cadastro não deve perguntar o objetivo ao usar a plataforma'
)
assert(
  isRetiredQuestion({
    code: 'main_objective',
    prompt: 'Qual é o objetivo principal ao usar a plataforma?',
    answerType: 'single',
    options: [],
    sortOrder: 40,
    segmentCode: null,
  }),
  'wizard deve ignorar main_objective mesmo se vier do banco'
)
assert(
  RETIRED_QUESTION_CODES.has('primary_activity'),
  'primary_activity deve estar aposentada: indicadores já vêm do ramo'
)
assert(
  !mixedCodes.has('primary_activity'),
  'cadastro não deve pedir a atividade principal em texto livre'
)
assert(
  isRetiredQuestion({
    code: 'primary_activity',
    prompt: 'Qual é a atividade principal da empresa?',
    answerType: 'text',
    options: [],
    sortOrder: 50,
    segmentCode: null,
  }),
  'wizard deve ignorar primary_activity mesmo se vier do banco'
)

for (const code of [
  'com_type',
  'com_products',
  'com_categories',
  'com_ticket',
  'com_volume',
  'com_costs',
  'agro_productivity',
  'agro_hectares',
  'agro_estimated_production',
  'pec_lots',
  'pec_area',
  'pec_avg_weight',
  'pec_arroba',
  'pec_cost_animal',
]) {
  assert(!mixedCodes.has(code), `pergunta redundante ainda aparece: ${code}`)
}

assert(mixedCodes.has('com_channel'), 'comércio ainda deve perguntar o canal de venda')
const channelQuestion = QUESTIONS.find((question) => question.code === 'com_channel')
assert(
  channelQuestion?.options?.map((item) => item.label).join() ===
    'Loja física,E-commerce,Marketplace',
  'canal de venda oferece loja física, e-commerce e marketplace'
)
assert(mixedCodes.has('pec_type'), 'pecuária ainda deve perguntar o tipo')
assert(mixedCodes.has('agro_crops'), 'agronegócio ainda deve perguntar as culturas')

const pecType = QUESTIONS.find((question) => question.code === 'pec_type')
assert(pecType?.answerType === 'multiple', 'tipo de pecuária deve aceitar várias opções')

console.log('questionnaire.test.ts ok')
