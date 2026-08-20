import {
  detectErpTabularLayout,
  normalizeHeader,
  parseErpTabularRows,
  stringDistance,
} from '../../../supabase/functions/_shared/erp/columns.ts'
import {
  assertSafeErpFile,
  sniffErpFormat,
} from '../../../supabase/functions/_shared/erp/inspect.ts'
import {
  heuristicMoneyGroup,
  parseAmount,
  parseBrazilianDate,
  sanitizeSpreadsheetText,
} from '../../../supabase/functions/_shared/erp/normalize.ts'
import { rowsFromCsvText } from '../../../supabase/functions/_shared/erp/csv.ts'
import { parseErpFile } from '../../../supabase/functions/_shared/erp/parse.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function encode(text: string) {
  return new TextEncoder().encode(text)
}

async function testCoreColumnsOnly() {
  const rows = [
    ['Relatório ERP'],
    [
      'Data',
      'Histórico',
      'Conta Contábil',
      'Centro de Custo',
      'Valor',
      'Documento',
      'Saldo',
      'Usuário',
      'Filial',
    ],
    [
      '15/01/2026',
      'Venda de mercadorias',
      '3.1.01',
      'Comercial',
      '1500,50',
      'NF-100',
      '9999',
      'admin',
      '01',
    ],
    [
      '16/01/2026',
      'Energia elétrica',
      '4.2.01',
      'Administrativo',
      '-320,00',
      'BOL-22',
      '9679',
      'admin',
      '01',
    ],
  ]

  const detected = detectErpTabularLayout(rows)
  assert(detected, 'layout deveria ser detectado')
  assert(detected.map.date >= 0, 'data')
  assert(detected.map.description >= 0, 'descrição')
  assert(detected.map.amount >= 0, 'valor')
  assert(detected.map.account >= 0, 'conta')
  assert(detected.map.costCenter >= 0, 'centro de custo')

  const ignored = detected.map.headerRoles.filter((item) => item.role === 'ignore')
  assert(
    ignored.some((item) => item.header.includes('documento') || item.header === 'documento'),
    'documento deve ser ignorado',
  )
  assert(
    ignored.some((item) => item.header.includes('saldo') || item.header === 'saldo'),
    'saldo deve ser ignorado',
  )

  const parsed = parseErpTabularRows(rows, detected.map)
  assert(parsed.entries.length === 2, `esperava 2, veio ${parsed.entries.length}`)
  assert(parsed.entries[0].accountCode === '3.1.01', 'conta código')
  assert(parsed.entries[0].costCenterName === 'Comercial', 'centro de custo')
  assert(parsed.entries[0].documentNumber == null, 'documento descartado')
}

async function testSavedMappingsPriority() {
  const rows = [
    ['Dia', 'Memo', 'Plano', 'CC', 'Vlr'],
    ['10/02/2026', 'CMV', '2.1.01', 'Produção', '-800'],
  ]
  const saved = {
    [normalizeHeader('Dia')]: 'date' as const,
    [normalizeHeader('Memo')]: 'description' as const,
    [normalizeHeader('Plano')]: 'account' as const,
    [normalizeHeader('CC')]: 'cost_center' as const,
    [normalizeHeader('Vlr')]: 'amount' as const,
  }
  const detected = detectErpTabularLayout(rows, saved)
  assert(detected, 'saved layout')
  assert(detected.map.date === 0, 'Dia → date via saved')
  assert(detected.map.account === 2, 'Plano → account via saved')
}

async function testFuzzyAndShortAlias() {
  assert(stringDistance('valor', 'valor') === 0, 'distância zero')
  assert(stringDistance('valor', 'xxxx') > 0.2, 'muito diferente')

  const rows = [
    ['D', 'C', 'X'],
    ['1', '2', '3'],
  ]
  const detected = detectErpTabularLayout(rows)
  assert(!detected || detected.score === 0 || detected.map.debit < 0, 'alias D curto não mapeia')
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

  try {
    assertSafeErpFile(
      'export.ofx',
      encode('OFXHEADER:100\nDATA:OFXSGML\n<OFX></OFX>'),
    )
    assert(false, 'OFX deve ser rejeitado no assert')
  } catch (error) {
    assert(
      error instanceof Error && error.message.includes('OFX'),
      'OFX rejeitado',
    )
  }

  assert(sniffErpFormat('plano.xlsx', encode('PK\x03\x04')) === 'xlsx', 'sniff xlsx')
  assert(sniffErpFormat('dados.csv', encode('a;b;c\n1;2;3')) === 'csv', 'sniff csv')
}

async function testSanitize() {
  assert(sanitizeSpreadsheetText('=cmd()') === 'cmd()', 'fórmula')
  assert(sanitizeSpreadsheetText('\t@SUM(A1)') === 'SUM(A1)', 'tab+@')
  assert(sanitizeSpreadsheetText('ok', 2) === 'ok', 'curto')
}

async function testHeuristic() {
  const revenue = heuristicMoneyGroup({
    accountCode: '3.1.01',
    accountName: 'Receita de vendas',
  })
  assert(revenue?.moneyGroup === 'revenue', 'receita por código 3')
}

async function testNormalizeHelpers() {
  assert(parseBrazilianDate('15/03/2026') === '2026-03-15', 'data BR')
  assert(parseAmount('1.234,56') === 1234.56, 'valor BR')
}

async function testOfxRejectedByParse() {
  try {
    await parseErpFile(
      'export.ofx',
      encode('OFXHEADER:100\nDATA:OFXSGML\n<OFX></OFX>'),
    )
    assert(false, 'parse OFX deve lançar')
  } catch (error) {
    assert(error instanceof Error, 'erro tipado')
  }
}

async function main() {
  await testCoreColumnsOnly()
  await testSavedMappingsPriority()
  await testFuzzyAndShortAlias()
  await testCsvParser()
  await testSafety()
  await testSanitize()
  await testHeuristic()
  await testNormalizeHelpers()
  await testOfxRejectedByParse()
  console.log('erpParse.test.ts: ok')
}

main().catch((error) => {
  console.error(error)
  throw error
})
