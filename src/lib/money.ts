const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

const percent = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 1,
})

const signedPercent = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
})

export function formatBRL(value: number) {
  return currency.format(value)
}

export function formatPct(value: number) {
  if (!Number.isFinite(value)) return '—'
  return percent.format(value)
}

export function formatSignedPct(value: number) {
  if (!Number.isFinite(value)) return '—'
  return signedPercent.format(value)
}

export function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}
