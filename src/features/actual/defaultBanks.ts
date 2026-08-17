export const DEFAULT_BANKS = [
  { bankCode: '001', name: 'Banco do Brasil' },
  { bankCode: '003', name: 'Banco da Amazônia' },
  { bankCode: '004', name: 'Banco do Nordeste' },
  { bankCode: '033', name: 'Santander' },
  { bankCode: '041', name: 'Banrisul' },
  { bankCode: '077', name: 'Inter' },
  { bankCode: '104', name: 'Caixa Econômica Federal' },
  { bankCode: '197', name: 'Stone' },
  { bankCode: '208', name: 'BTG Pactual' },
  { bankCode: '212', name: 'Banco Original' },
  { bankCode: '237', name: 'Bradesco' },
  { bankCode: '260', name: 'Nubank' },
  { bankCode: '290', name: 'PagBank' },
  { bankCode: '323', name: 'Mercado Pago' },
  { bankCode: '336', name: 'C6 Bank' },
  { bankCode: '341', name: 'Itaú' },
  { bankCode: '380', name: 'PicPay' },
  { bankCode: '422', name: 'Safra' },
  { bankCode: '623', name: 'Banco Pan' },
  { bankCode: '748', name: 'Sicredi' },
  { bankCode: '756', name: 'Sicoob' },
] as const

export function isDefaultBankAccount(account: {
  bank_code?: string | null
  bank_name?: string | null
  name: string
}) {
  const code = account.bank_code?.trim()
  if (code && DEFAULT_BANKS.some((bank) => bank.bankCode === code)) return true

  const names = [account.bank_name, account.name]
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value))

  return DEFAULT_BANKS.some((bank) => names.includes(bank.name.toLowerCase()))
}
