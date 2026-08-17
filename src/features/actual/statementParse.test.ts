import { parseStatement } from '../../../supabase/functions/_shared/statement/parse.ts'
import { assertSafeStatementFile } from '../../../supabase/functions/_shared/statement/inspect.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function encode(text: string) {
  return new TextEncoder().encode(text)
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

await testOfx()
await testCsv()
testRejectsExecutable()
await testUnknownFormat()
console.log('statement parse tests ok')
