const BANKS: Array<{ code: string; name: string; aliases: string[] }> = [
  { code: '001', name: 'Banco do Brasil', aliases: ['banco do brasil', 'bb'] },
  { code: '003', name: 'Banco da Amazônia', aliases: ['banco da amazonia', 'basa'] },
  { code: '004', name: 'Banco do Nordeste', aliases: ['banco do nordeste', 'bnb'] },
  { code: '033', name: 'Santander', aliases: ['santander'] },
  { code: '041', name: 'Banrisul', aliases: ['banrisul'] },
  { code: '077', name: 'Inter', aliases: ['banco inter', 'inter'] },
  { code: '104', name: 'Caixa Econômica Federal', aliases: ['caixa', 'cef'] },
  { code: '197', name: 'Stone', aliases: ['stone'] },
  { code: '208', name: 'BTG Pactual', aliases: ['btg', 'btg pactual'] },
  { code: '212', name: 'Banco Original', aliases: ['original'] },
  { code: '237', name: 'Bradesco', aliases: ['bradesco'] },
  { code: '260', name: 'Nubank', aliases: ['nubank', 'nu pagamentos', 'nubank ip'] },
  { code: '290', name: 'PagBank', aliases: ['pagbank', 'pagseguro'] },
  { code: '323', name: 'Mercado Pago', aliases: ['mercado pago', 'mercadopago'] },
  { code: '336', name: 'C6 Bank', aliases: ['c6', 'c6 bank'] },
  { code: '341', name: 'Itaú', aliases: ['itau', 'itaú'] },
  { code: '380', name: 'PicPay', aliases: ['picpay'] },
  { code: '422', name: 'Safra', aliases: ['safra'] },
  { code: '623', name: 'Banco Pan', aliases: ['banco pan', 'pan'] },
  { code: '748', name: 'Sicredi', aliases: ['sicredi'] },
  { code: '756', name: 'Sicoob', aliases: ['sicoob'] },
]

export function detectBank(text: string, bankId?: string | null): {
  bankCode: string | null
  bankName: string | null
} {
  const id = (bankId ?? '').replace(/\D/g, '').padStart(3, '0')
  if (id.length >= 3) {
    const byCode = BANKS.find((bank) => bank.code === id.slice(-3))
    if (byCode) return { bankCode: byCode.code, bankName: byCode.name }
  }

  const haystack = text.toLowerCase()
  for (const bank of BANKS) {
    if (bank.aliases.some((alias) => haystack.includes(alias))) {
      return { bankCode: bank.code, bankName: bank.name }
    }
  }

  return { bankCode: id.length >= 3 ? id.slice(-3) : null, bankName: null }
}
