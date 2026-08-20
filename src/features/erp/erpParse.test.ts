import { detectErpTabularLayout, parseErpTabularRows } from '../../../supabase/functions/_shared/erp/columns.ts'
import { assertSafeErpFile, sniffErpFormat } from '../../../supabase/functions/_shared/erp/inspect.ts'
import { heuristicMoneyGroup, parseAmount, parseBrazilianDate } from '../../../supabase/functions/_shared/erp/normalize.ts'
import { rowsFromCsvText } from '../../../supabase/functions/_shared/erp/csv.ts'
import { parseErpFile } from '../../../supabase/functions/_shared/erp/parse.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function encode(text: string) {
  return new TextEncoder().encode(text)
}

async function testColumnDetection() {
  const rows = [
    ['Ignorar', 'cabeçalho', 'extra'],
    [
      'Data',
      'Histórico',
      'Conta Contábil',
      'Nome Conta',
      'Centro de Custo',
      'Débito',
      'Crédito',
    ],
    [
      '15/01/2026',
      'Venda de mercadorias',
      '3.1.01',
      'Receita de vendas',
      'Comercial',
      '',
      '1500,50',
    ],
    [
      '16/01/2026',
      'Energia elétrica',
      '4.2.01',
      'Despesas com energia',
      'Administrativo',
      '320,00',
      '',
    ],
  ]

  const detected = detectErpTabularLayout(rows)
  assert(detected, 'layout deveria ser detectado')
  assert(detected.map.headerIndex === 1, 'header na linha 2')
  assert(detected.map.date >= 0, 'coluna data')
  assert(detected.map.description >= 0, 'coluna descrição')
  assert(detected.map.accountCode >= 0, 'coluna conta')
  assert(detected.map.costCenter >= 0, 'coluna centro de custo')
  assert(detected.map.debit >= 0 && detected.map.credit >= 0, 'débito/crédito')

  const parsed = parseErpTabularRows(rows, detected.map)
  assert(parsed.entries.length === 2, `esperava 2 entradas, veio ${parsed.entries.length}`)
  assert(parsed.entries[0].entrySide === 'credit', 'primeira deve ser crédito')
  assert(parsed.entries[0].suggestedMoneyGroup === 'revenue', 'heurística receita')
  assert(parsed.entries[1].entrySide === 'debit', 'segunda deve ser débito')
  assert(parsed.entries[1].suggestedMoneyGroup === 'expense', 'heurística despesa')
}

async function testCsvParser() {
  const csv = `Data;Descrição;Código Conta;Centro Custo;Valor
10/02/2026;CMV produtos;2.1.01;Produção;-800,00
11/02/2026;Serviço prestado;3.2.01;Serviços;1200,00
`
  const rows = rowsFromCsvText(csv)
  const detected = detectErpTabularLayout(rows)
  assert(detected, 'CSV layout')
  const parsed = parseErpTabularRows(rows, detected.map)
  assert(parsed.entries.length === 2, 'duas linhas CSV')
  assert(parsed.entries[0].type === 'expense', 'CMV como saída')
  assert(parsed.entries[1].type === 'income', 'serviço como entrada')
}

async function testSafety() {
  try {
    assertSafeErpFile('malware.exe', encode('MZ\0\0fake'))
    assert(false, 'executável deveria falhar')
  } catch (error) {
    assert(
      error instanceof Error && error.message.includes('não é um export'),
      'mensagem de segurança',
    )
  }

  assert(sniffErpFormat('plano.xlsx', encode('PK\x03\x04')) === 'xlsx', 'sniff xlsx')
  assert(sniffErpFormat('dados.csv', encode('a;b;c\n1;2;3')) === 'csv', 'sniff csv')
}

async function testHeuristic() {
  const revenue = heuristicMoneyGroup({
    accountCode: '3.1.01',
    accountName: 'Receita de vendas',
  })
  assert(revenue?.moneyGroup === 'revenue', 'receita por código 3')

  const cost = heuristicMoneyGroup({
    accountName: 'CMV - custo da mercadoria',
    costCenterName: 'Produção',
  })
  assert(cost?.moneyGroup === 'cost', 'custo por CMV')

  const investment = heuristicMoneyGroup({
    description: 'Aquisição de equipamento imobilizado',
  })
  assert(investment?.moneyGroup === 'investment', 'investimento')
}

async function testNormalizeHelpers() {
  assert(parseBrazilianDate('15/03/2026') === '2026-03-15', 'data BR')
  assert(parseAmount('1.234,56') === 1234.56, 'valor BR')
  assert(parseAmount('(100,00)') === 100, 'valor entre parênteses')
}

async function testOfxStub() {
  const result = await parseErpFile(
    'export.ofx',
    encode('OFXHEADER:100\nDATA:OFXSGML\n<OFX></OFX>'),
  )
  assert(result.format === 'ofx', 'formato ofx')
  assert(result.entries.length === 0, 'sem entradas ainda')
  assert(result.warnings.length > 0, 'aviso de não implementado')
}

async function main() {
  await testColumnDetection()
  await testCsvParser()
  await testSafety()
  await testHeuristic()
  await testNormalizeHelpers()
  await testOfxStub()
  console.log('erpParse.test.ts: ok')
}

main().catch((error) => {
  console.error(error)
  throw error
})
