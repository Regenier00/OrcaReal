import { parseLedgerAccountCsv } from '../../../supabase/functions/_shared/ledgerAccounts/parse.ts'
import { assertSafeLedgerAccountFile } from '../../../supabase/functions/_shared/ledgerAccounts/inspect.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const csv = new TextEncoder().encode(
  'Número da conta,Descrição da conta\n3.4.01.0001,RATEIO DEPARTAMENTOS\n4.1.01.0002,SALARIOS\n'
)

const parsed = parseLedgerAccountCsv(csv)
assert(parsed.rows.length === 2, 'parseia 2 contas do CSV')
assert(parsed.rows[0].account_code === '3.4.01.0001', 'código da primeira conta')
assert(parsed.rows[0].account_name === 'RATEIO DEPARTAMENTOS', 'descrição da primeira conta')
assert(parsed.layout.columns.account_code === 0, 'coluna 1 = número')
assert(parsed.layout.columns.account_name === 1, 'coluna 2 = descrição')

const pipeCsv = new TextEncoder().encode('3.4.01.0001 | RATEIO DEPARTAMENTOS\n')
const pipeParsed = parseLedgerAccountCsv(pipeCsv)
assert(pipeParsed.rows.length === 1, 'aceita pipe em uma coluna')
assert(pipeParsed.rows[0].account_code === '3.4.01.0001', 'código via pipe')

const format = assertSafeLedgerAccountFile({
  fileName: 'plano.csv',
  mimeType: 'text/csv',
  bytes: csv,
})
assert(format === 'csv', 'detecta CSV')

try {
  assertSafeLedgerAccountFile({
    fileName: 'plano.exe',
    mimeType: 'application/octet-stream',
    bytes: csv,
  })
  throw new Error('deveria rejeitar extensão inválida')
} catch (error) {
  assert(
    error instanceof Error && error.message.includes('XLSX'),
    'rejeita arquivo sem extensão permitida'
  )
}

console.log('ledger account import tests ok')
