import { unit } from './helpers'
import type { AnalysisUnitDef } from '../types'

const AGRO = ['agro']
const PEC = ['livestock']
const FISH = ['fishing']
const COM = ['commerce']
const IND = ['industry']
const CON = ['construction']
const SRV = ['services', 'professional', 'financial']
const TECH = ['tech']
const TRN = ['transport_logistics']
const FOOD = ['food']
const HOT = ['hospitality']
const HLTH = ['health']
const EDU = ['education']
const RE = ['real_estate']
const AUTO = ['automotive']
const ENG = ['energy']
const MIN = ['mining']
const MEDIA = ['media', 'marketing']
const PLAY = ['entertainment', 'sports']
const BEAU = ['beauty']
const ENV = ['environment']
const PUB = ['public_admin']
const ALL = [
  ...AGRO,
  ...PEC,
  ...FISH,
  ...COM,
  ...IND,
  ...CON,
  ...SRV,
  ...TECH,
  ...TRN,
  ...FOOD,
  ...HOT,
  ...HLTH,
  ...EDU,
  ...RE,
  ...AUTO,
  ...ENG,
  ...MIN,
  ...MEDIA,
  ...PLAY,
  ...BEAU,
  ...ENV,
  ...PUB,
  'other',
]

export const ANALYSIS_UNITS: AnalysisUnitDef[] = [
  unit('hectare', 'Hectare', [...AGRO, ...PEC, ...FISH], 'Área produtiva'),
  unit('bag', 'Saca', AGRO, 'Produção em sacas'),
  unit('ton', 'Tonelada', [...AGRO, ...IND, ...MIN, ...FISH, ...ENV], 'Volume em toneladas'),
  unit('crop', 'Cultura', AGRO, 'Cultura agrícola'),
  unit('animal', 'Animal', PEC, 'Animal individual'),
  unit('head', 'Cabeça', PEC, 'Cabeça de gado'),
  unit('arroba', 'Arroba', PEC, 'Produção em arrobas'),
  unit('lot', 'Lote', [...PEC, ...IND], 'Lote de animais ou produção'),
  unit('product', 'Produto', [...COM, ...IND, ...FOOD, ...AUTO], 'Produto comercializado ou fabricado'),
  unit('sold_unit', 'Unidade vendida', COM, 'Unidade vendida'),
  unit('category', 'Categoria', COM, 'Categoria de produtos'),
  unit('store', 'Loja', [...COM, ...FOOD, ...BEAU], 'Unidade comercial'),
  unit('produced_unit', 'Unidade produzida', IND, 'Unidade fabricada'),
  unit('km', 'Km', TRN, 'Quilômetro rodado'),
  unit('trip', 'Viagem', TRN, 'Viagem realizada'),
  unit('vehicle', 'Veículo', [...TRN, ...AUTO], 'Veículo da operação'),
  unit('transported_ton', 'Tonelada transportada', TRN, 'Carga transportada'),
  unit('work', 'Obra', CON, 'Obra ou empreendimento'),
  unit('sqm', 'm²', CON, 'Metro quadrado construído'),
  unit('work_stage', 'Etapa da obra', CON, 'Etapa construtiva'),
  unit('client', 'Cliente', [...SRV, ...TECH, ...MEDIA, ...ENV, ...FOOD], 'Cliente atendido'),
  unit('project', 'Projeto', [...SRV, ...TECH, ...MEDIA, ...ENV], 'Projeto realizado'),
  unit('contract', 'Contrato', [...SRV, ...TECH, ...RE, 'financial'], 'Contrato vigente'),
  unit('worked_hour', 'Hora trabalhada', [...SRV, ...TECH, ...MEDIA, ...AUTO, ...BEAU], 'Hora de trabalho'),
  unit('user', 'Usuário', TECH, 'Usuário da plataforma'),
  unit('meal', 'Refeição', FOOD, 'Refeição servida'),
  unit('order', 'Pedido', FOOD, 'Pedido realizado'),
  unit('appointment', 'Consulta', HLTH, 'Consulta realizada'),
  unit('procedure', 'Procedimento', HLTH, 'Procedimento realizado'),
  unit('patient', 'Paciente', HLTH, 'Paciente atendido'),
  unit('student', 'Aluno', EDU, 'Aluno matriculado'),
  unit('class_group', 'Turma', EDU, 'Turma'),
  unit('course', 'Curso', EDU, 'Curso oferecido'),
  unit('property', 'Imóvel', RE, 'Imóvel administrado'),
  unit('service', 'Serviço', [...AUTO, ...BEAU, ...SRV], 'Serviço realizado'),
  unit('kwh', 'kWh', ENG, 'Energia produzida ou consumida'),
  unit('extracted_unit', 'Unidade extraída', MIN, 'Unidade mineral extraída'),
  unit('room', 'Quarto', HOT, 'Unidade habitacional'),
  unit('guest', 'Hóspede', HOT, 'Hóspede atendido'),
  unit('reservation', 'Reserva', HOT, 'Reserva realizada'),
  unit('attendance', 'Atendimento', BEAU, 'Atendimento realizado'),
  unit('professional', 'Profissional', [...BEAU, ...HLTH], 'Profissional da operação'),
  unit('campaign', 'Campanha', MEDIA, 'Campanha de mídia ou marketing'),
  unit('event', 'Evento', PLAY, 'Evento realizado'),
  unit('employee', 'Funcionário', ALL, 'Colaborador'),
]
