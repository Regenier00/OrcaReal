import { isDefaultBankAccount } from './defaultBanks.ts'
import type { RawMovement } from '../../../supabase/functions/_shared/statement/types.ts'
import { parseStatement } from '../../../supabase/functions/_shared/statement/parse.ts'
import { parseTabularRows } from '../../../supabase/functions/_shared/statement/csv.ts'
import { detectTabularLayout } from '../../../supabase/functions/_shared/statement/columns.ts'
import { assertSafeStatementFile } from '../../../supabase/functions/_shared/statement/inspect.ts'
import { excelSerialToIso } from '../../../supabase/functions/_shared/statement/normalize.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function encode(text: string) {
  return new TextEncoder().encode(text)
}

function byDescription(result: { movements: RawMovement[] }, text: string) {
  return result.movements.find((item) => item.description.includes(text))
}

async function testOfx() {
  const ofx = `OFXHEADER:100
DATA:OFXSGML
<OFX>
<BANKID>341
<ACCTID>12345-6
<CURDEF>BRL
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260815
<TRNAMT>-150,90
<FITID>abc-1
<MEMO>PAGAMENTO FORNECEDOR
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260816
<TRNAMT>2000.00
<FITID>abc-2
<MEMO>TED RECEBIDA CLIENTE
</STMTTRN>
</OFX>
`
  const result = await parseStatement('extrato.ofx', encode(ofx))
  assert(result.format === 'ofx', `esperado ofx, veio ${result.format}`)
  assert(result.bankName === 'Itaú', `banco ${result.bankName}`)
  assert(result.movements.length === 2, `lançamentos ${result.movements.length}`)
  assert(result.movements[0]?.type === 'expense', 'primeiro deve ser saída')
  assert(result.movements[0]?.amount === 150.9, `valor ${result.movements[0]?.amount}`)
  assert(result.movements[1]?.type === 'transfer', 'TED deve ser transferência')
  assert(result.movements[1]?.amount === 2000, `crédito ${result.movements[1]?.amount}`)
}

async function testCsv() {
  const csv = `Data;Historico;Valor
15/08/2026;Aluguel sala;-1.250,00
16/08/2026;Venda PDV;350,50
`
  const result = await parseStatement('extrato.csv', encode(csv))
  assert(result.format === 'csv', `esperado csv, veio ${result.format}`)
  assert(result.movements.length === 2, `lançamentos ${result.movements.length}`)
  assert(result.movements[0]?.postedAt === '2026-08-15', result.movements[0]?.postedAt ?? '')
  assert(result.movements[0]?.type === 'expense', 'aluguel deve ser saída')
  assert(result.movements[0]?.amount === 1250, `aluguel ${result.movements[0]?.amount}`)
  assert(result.movements[1]?.type === 'income', 'venda deve ser entrada')
  assert(result.movements[1]?.amount === 350.5, `venda ${result.movements[1]?.amount}`)
}

function testHeaderWithCurrencyAndSlash() {
  const result = parseTabularRows([
    ['Data', 'Histórico / Descrição', 'Documento', 'Valor (R$)', 'Tipo', 'Saldo (R$)'],
    ['01/08/2026', 'SALDO ANTERIOR', '-', '0.0', 'Saldo Inicial', '1250.0'],
    ['01/08/2026', 'PIX RECEBIDO - Maria Oliveira', '0012394', '350.0', 'Crédito', '1600.0'],
    ['02/08/2026', 'COMPRA CARTAO DEB - Supermercado ABC', '884102', '-185.4', 'Débito', '1414.6'],
  ])
  assert(result.movements.length === 2, `esperado 2, veio ${result.movements.length}`)
  const pix = byDescription(result, 'PIX RECEBIDO')
  const compra = byDescription(result, 'COMPRA CARTAO')
  assert(pix?.postedAt === '2026-08-01', pix?.postedAt ?? '')
  assert(pix?.type === 'income', `pix tipo ${pix?.type}`)
  assert(pix?.amount === 350, `pix ${pix?.amount}`)
  assert(pix?.documentNumber === '0012394', pix?.documentNumber ?? '')
  assert(compra?.type === 'expense', `compra tipo ${compra?.type}`)
  assert(compra?.amount === 185.4, `compra ${compra?.amount}`)
  assert(
    !result.movements.some((item) => item.description.includes('SALDO ANTERIOR')),
    'saldo anterior não é lançamento',
  )
}

function testHeaderBelowBankTitle() {
  const result = parseTabularRows([
    ['BANCO FICTÍCIO S.A. - EXTRATO DE CONTA CORRENTE'],
    ['Cliente: Henrique Orçamento | Agência: 0001 | Conta: 123456-7 | Período: 01/08/2026 a 15/08/2026'],
    ['', '', '', '', '', ''],
    ['Data', 'Histórico / Descrição', 'Documento', 'Tipo', 'Valor (R$)', 'Saldo (R$)'],
    ['01/08/2026', 'SALDO ANTERIOR', '-', 'Saldo Inicial', '0,00', '1.250,00'],
    ['01/08/2026', 'PIX RECEBIDO - Maria Oliveira', '0012394', 'Crédito', '350,00', '1.600,00'],
    ['02/08/2026', 'COMPRA CARTAO DEB - Supermercado ABC', '884102', 'Débito', '-185,40', '1.414,60'],
    ['05/08/2026', 'SALARIO', '998100', 'Crédito', '3.500,00', '4.914,60'],
  ])
  const layout = detectTabularLayout([
    ['BANCO FICTÍCIO S.A. - EXTRATO DE CONTA CORRENTE'],
    ['Cliente: Henrique Orçamento | Agência: 0001 | Conta: 123456-7'],
    ['', '', '', '', '', ''],
    ['Data', 'Histórico / Descrição', 'Documento', 'Tipo', 'Valor (R$)', 'Saldo (R$)'],
    ['01/08/2026', 'PIX RECEBIDO', '0012394', 'Crédito', '350,00', '1.600,00'],
  ])
  assert(layout?.headerIndex === 3, `cabeçalho na linha ${layout?.headerIndex}`)
  assert(result.movements.length === 3, `esperado 3, veio ${result.movements.length}`)
  assert(byDescription(result, 'SALARIO')?.amount === 3500, 'salário com milhar brasileiro')
  assert(byDescription(result, 'SALARIO')?.type === 'income', 'salário deve ser entrada')
}

function testNoHeaderInfersColumns() {
  const result = parseTabularRows([
    ['01/08/2026', 'PIX RECEBIDO - Maria Oliveira', '350.00'],
    ['02/08/2026', 'COMPRA CARTAO DEB - Supermercado ABC', '-185.40'],
  ])
  assert(result.movements.length === 2, `sem cabeçalho: ${result.movements.length}`)
  assert(byDescription(result, 'PIX RECEBIDO')?.type === 'income', 'pix inferido')
  assert(byDescription(result, 'COMPRA CARTAO')?.type === 'expense', 'compra inferida')
}

function testDebitCreditColumns() {
  const result = parseTabularRows([
    ['Data', 'Histórico', 'Débito', 'Crédito', 'Saldo'],
    ['10/08/2026', 'Pagamento fornecedor', '90,00', '', '910,00'],
    ['11/08/2026', 'Depósito cliente', '', '200,00', '1.110,00'],
  ])
  assert(result.movements.length === 2, `débito/crédito: ${result.movements.length}`)
  assert(byDescription(result, 'Pagamento')?.type === 'expense', 'débito')
  assert(byDescription(result, 'Pagamento')?.amount === 90, 'valor débito')
  assert(byDescription(result, 'Depósito')?.type === 'income', 'crédito')
}

function testEnglishHeaders() {
  const result = parseTabularRows([
    ['Date', 'Description', 'Amount'],
    ['08/15/2026', 'Office rent', '-1250.00'],
    ['16/08/2026', 'POS sale', '350.50'],
  ])
  assert(result.movements.length === 2, `english: ${result.movements.length}`)
  assert(result.movements[0]?.postedAt === '2026-08-15', result.movements[0]?.postedAt ?? '')
  assert(result.movements[0]?.type === 'expense', 'rent')
}

function testExcelSerialDates() {
  const serial = Math.round(
    (Date.UTC(2026, 7, 1) - Date.UTC(1899, 11, 30)) / 86400000,
  )
  assert(excelSerialToIso(serial) === '2026-08-01', excelSerialToIso(serial) ?? '')
  const result = parseTabularRows([
    ['Data', 'Histórico / Descrição', 'Valor (R$)'],
    [String(serial), 'PIX RECEBIDO - Maria Oliveira', '350'],
    [String(serial + 1), 'TARIFA MANUTENCAO', '-12.9'],
  ])
  assert(byDescription(result, 'PIX RECEBIDO')?.postedAt === '2026-08-01', 'serial date')
  assert(byDescription(result, 'TARIFA')?.postedAt === '2026-08-02', 'serial + 1')
  assert(byDescription(result, 'TARIFA')?.type === 'expense', 'tarifa')
}

function testTipoOverridesUnsignedAmount() {
  const result = parseTabularRows([
    ['Data', 'Descrição', 'Valor', 'Tipo'],
    ['03/08/2026', 'Tarifa manutencao', '12,90', 'Débito'],
    ['03/08/2026', 'Estorno tarifa', '12,90', 'Crédito'],
  ])
  assert(byDescription(result, 'Tarifa manutencao')?.type === 'expense', 'tipo débito')
  assert(byDescription(result, 'Estorno')?.type === 'income', 'tipo crédito')
}

async function testCsvWithPreamble() {
  const csv = `BANCO FICTÍCIO S.A. - EXTRATO DE CONTA CORRENTE
Cliente: Henrique | Agencia: 0001 | Conta: 123456-7
Data;Histórico / Descrição;Documento;Valor (R$);Tipo;Saldo (R$)
01/08/2026;PIX RECEBIDO - Maria Oliveira;0012394;350,00;Crédito;1600,00
02/08/2026;COMPRA CARTAO DEB - Supermercado ABC;884102;-185,40;Débito;1414,60
`
  const result = await parseStatement('extrato-banco.csv', encode(csv))
  assert(result.movements.length === 2, `preamble csv: ${result.movements.length}`)
  assert(byDescription(result, 'PIX RECEBIDO')?.amount === 350, 'pix csv')
}

function testCommonBrazilianLayouts() {
  const itau = parseTabularRows([
    ['Data', 'Lançamento', 'Detalhes', 'Valor', 'Saldo'],
    ['12/08/2026', 'PAGTO BOLETO', 'Conta de luz', '-80,00', '420,00'],
    ['12/08/2026', 'REND PAGO', 'CDB Pos', '2,15', '422,15'],
  ])
  assert(itau.movements.length === 2, `itau ${itau.movements.length}`)
  assert(byDescription(itau, 'PAGTO BOLETO')?.type === 'expense', 'itau boleto')

  const caixa = parseTabularRows([
    ['Data Mov.', 'Nr. Doc.', 'Histórico', 'Valor', 'Saldo'],
    ['01.08.2026', '123', 'CREDITO PIX', '500,00', '500,00'],
    ['04.08.2026', '124', 'TARIFA BANCARIA', '-13,00', '487,00'],
  ])
  assert(caixa.movements.length === 2, `caixa ${caixa.movements.length}`)
  assert(caixa.movements[0]?.postedAt === '2026-08-01', caixa.movements[0]?.postedAt ?? '')
  assert(byDescription(caixa, 'TARIFA BANCARIA')?.type === 'expense', 'caixa tarifa')
}

function testRejectsExecutable() {
  const mz = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03])
  let failed = false
  try {
    assertSafeStatementFile('malware.exe', mz)
  } catch {
    failed = true
  }
  assert(failed, 'executável deveria ser recusado')
}

async function testUnknownFormat() {
  let failed = false
  try {
    await parseStatement('arquivo.bin', encode('%%% not a statement %%%'))
  } catch {
    failed = true
  }
  assert(failed, 'formato desconhecido deveria falhar')
}

function testDefaultBankFilter() {
  assert(
    isDefaultBankAccount({ bank_code: '341', bank_name: 'Itaú', name: 'Itaú' }),
    'Itaú padrão deveria aparecer',
  )
  assert(
    isDefaultBankAccount({ bank_code: null, bank_name: null, name: 'Nubank' }),
    'Nubank pelo nome deveria aparecer',
  )
  assert(
    !isDefaultBankAccount({
      bank_code: null,
      bank_name: null,
      name: 'Conta da empresa',
    }),
    'conta avulsa não deveria aparecer',
  )
}

function testSparseExcelLikeRows() {
  const header: string[] = []
  header[1] = 'Data'
  header[3] = 'Título'
  header[5] = 'Valor (R$)'
  const pix: string[] = []
  pix[1] = '01/08/2026'
  pix[3] = 'PIX RECEBIDO - Maria Oliveira'
  pix[5] = '350,00'
  const tarifa: string[] = []
  tarifa[1] = '02/08/2026'
  tarifa[3] = 'TARIFA MANUTENCAO'
  tarifa[5] = '-12,90'

  const result = parseTabularRows([header, pix, tarifa])
  assert(result.warnings.every((item) => !item.message.includes('toLowerCase')), 'não deve quebrar no cabeçalho')
  assert(result.movements.length === 2, `linhas esparsas: ${result.movements.length}`)
  assert(byDescription(result, 'PIX RECEBIDO')?.amount === 350, 'pix esparso')
  assert(byDescription(result, 'TARIFA')?.type === 'expense', 'tarifa esparsa')
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of data) {
    crc ^= byte
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.byteLength
  }
  return out
}

function u16(value: number) {
  return Uint8Array.of(value & 0xff, (value >> 8) & 0xff)
}

function u32(value: number) {
  return Uint8Array.of(
    value & 0xff,
    (value >> 8) & 0xff,
    (value >> 16) & 0xff,
    (value >> 24) & 0xff,
  )
}

function zipStore(files: Record<string, string>) {
  const encoder = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name)
    const data = encoder.encode(content)
    const crc = crc32(data)
    const local = concatBytes([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.byteLength),
      u32(data.byteLength),
      u16(nameBytes.byteLength),
      u16(0),
      nameBytes,
      data,
    ])
    const central = concatBytes([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.byteLength),
      u32(data.byteLength),
      u16(nameBytes.byteLength),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes,
    ])
    locals.push(local)
    centrals.push(central)
    offset += local.byteLength
  }

  const centralDir = concatBytes(centrals)
  return concatBytes([
    ...locals,
    centralDir,
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(centrals.length),
    u16(centrals.length),
    u32(centralDir.byteLength),
    u32(offset),
    u16(0),
  ])
}

function cell(ref: string, value: string, shared = false) {
  if (shared) return `<c r="${ref}" t="s"><v>${value}</v></c>`
  if (/^-?\d+(\.\d+)?$/.test(value)) return `<c r="${ref}"><v>${value}</v></c>`
  return `<c r="${ref}" t="str"><v>${value}</v></c>`
}

function xlsxFiles(sheets: Record<string, string>, sharedXml?: string) {
  const files: Record<string, string> = {
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>',
  }
  if (sharedXml) files['xl/sharedStrings.xml'] = sharedXml
  for (const [name, xml] of Object.entries(sheets)) {
    files[`xl/worksheets/${name}`] = xml
  }
  return files
}

async function testSparseXlsxDoesNotCrash() {
  const sheet = `<?xml version="1.0"?>
<worksheet><sheetData>
  <row r="1">${cell('B1', 'Data')}${cell('D1', 'Título')}${cell('F1', 'Valor (R$)')}</row>
  <row r="2">${cell('B2', '01/08/2026')}${cell('D2', 'PIX RECEBIDO - Maria Oliveira')}${cell('F2', '350.00')}</row>
  <row r="3">${cell('B3', '02/08/2026')}${cell('D3', 'TARIFA MANUTENCAO')}${cell('F3', '-12.90')}</row>
</sheetData></worksheet>`

  const result = await parseStatement(
    'extrato-inter.xlsx',
    zipStore(xlsxFiles({ 'sheet1.xml': sheet })),
  )
  assert(
    !result.warnings.some((item) => item.message.includes('toLowerCase')),
    result.warnings[0]?.message ?? 'xlsx esparso quebrou',
  )
  assert(result.format === 'xlsx', `formato ${result.format}`)
  assert(result.movements.length === 2, `xlsx esparso: ${result.movements.length}`)
  assert(byDescription(result, 'PIX RECEBIDO')?.amount === 350, 'pix xlsx')
  assert(byDescription(result, 'TARIFA')?.type === 'expense', 'tarifa xlsx')
}

async function testNamespacedXlsxAndSecondSheet() {
  const cover = `<?xml version="1.0"?>
<x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <x:sheetData>
    <x:row r="1"><x:c r="C1" t="str"><x:v>BANCO INTER - EXTRATO</x:v></x:c></x:row>
    <x:row r="3"><x:c r="C3" t="str"><x:v>Agencia 0001 Conta 12345-6</x:v></x:c></x:row>
  </x:sheetData>
</x:worksheet>`

  const extrato = `<?xml version="1.0"?>
<x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <x:sheetData>
    <x:row r="1">
      <x:c r="A1" t="str"><x:v>Data da transação</x:v></x:c>
      <x:c r="B1" t="str"><x:v>Descrição</x:v></x:c>
      <x:c r="C1" t="str"><x:v>Valor líquido</x:v></x:c>
    </x:row>
    <x:row r="2">
      <x:c r="A2" t="str"><x:v>10/08/2026</x:v></x:c>
      <x:c r="B2" t="str"><x:v>PIX RECEBIDO CLIENTE</x:v></x:c>
      <x:c r="C2"><x:v>200.5</x:v></x:c>
    </x:row>
    <x:row r="3">
      <x:c r="A3" t="str"><x:v>11/08/2026</x:v></x:c>
      <x:c r="B3" t="str"><x:v>PAGAMENTO FORNECEDOR</x:v></x:c>
      <x:c r="C3"><x:v>-80</x:v></x:c>
    </x:row>
  </x:sheetData>
</x:worksheet>`

  const result = await parseStatement(
    'extrato-formato-diferente.xlsx',
    zipStore(xlsxFiles({ 'sheet1.xml': cover, 'sheet2.xml': extrato })),
  )
  assert(
    !result.warnings.some((item) => item.message.includes('toLowerCase')),
    result.warnings[0]?.message ?? 'capa namespaced quebrou',
  )
  assert(result.movements.length === 2, `aba 2: ${result.movements.length}`)
  assert(result.bankName === 'Inter', `banco ${result.bankName}`)
  assert(byDescription(result, 'PIX RECEBIDO CLIENTE')?.amount === 200.5, 'valor líquido')
  assert(byDescription(result, 'PAGAMENTO FORNECEDOR')?.type === 'expense', 'saída na segunda aba')
}

await testOfx()
await testCsv()
testHeaderWithCurrencyAndSlash()
testHeaderBelowBankTitle()
testNoHeaderInfersColumns()
testDebitCreditColumns()
testEnglishHeaders()
testExcelSerialDates()
testTipoOverridesUnsignedAmount()
await testCsvWithPreamble()
testCommonBrazilianLayouts()
testSparseExcelLikeRows()
testRejectsExecutable()
await testUnknownFormat()
testDefaultBankFilter()
await testSparseXlsxDoesNotCrash()
await testNamespacedXlsxAndSecondSheet()
console.log('statement parse tests ok')
