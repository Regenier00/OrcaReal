const moneyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

export function formatMoney(value: number) {
  return moneyFormatter.format(Number.isFinite(value) ? value : 0)
}

export function formatMoneyInput(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)
}

export type MoneyParseResult =
  | { ok: true; value: number }
  | { ok: false; error: string }

export function parseMoney(input: string): MoneyParseResult {
  const raw = input.trim().replace(/r\$/gi, '').replace(/\s/g, '')
  if (!raw) return { ok: true, value: 0 }
  if (raw.startsWith('-') || raw.includes('-')) {
    return { ok: false, error: 'Valores negativos não são permitidos.' }
  }
  if (!/^[\d.,]+$/.test(raw)) {
    return { ok: false, error: 'Informe um valor monetário válido.' }
  }

  let normalized: string
  if (raw.includes(',')) {
    const [integerPart, ...decimalParts] = raw.split(',')
    if (decimalParts.length !== 1) {
      return { ok: false, error: 'Informe um valor monetário válido.' }
    }
    normalized = `${integerPart.replace(/\./g, '')}.${decimalParts[0]}`
  } else if (/^\d+\.\d{1,2}$/.test(raw)) {
    normalized = raw
  } else {
    normalized = raw.replace(/\./g, '')
  }

  const value = Number(normalized)
  if (!Number.isFinite(value)) {
    return { ok: false, error: 'Informe um valor monetário válido.' }
  }
  if (value < 0) {
    return { ok: false, error: 'Valores negativos não são permitidos.' }
  }

  return { ok: true, value: roundMoney(value) }
}

export function distributeEqually(total: number, count: number) {
  if (count <= 0) return []
  const cents = Math.round(roundMoney(total) * 100)
  const base = Math.floor(cents / count)
  const remainder = cents - base * count
  return Array.from({ length: count }, (_, index) =>
    roundMoney((base + (index < remainder ? 1 : 0)) / 100)
  )
}

export function applyPercent(value: number, percent: number) {
  return roundMoney(value * (1 + percent / 100))
}
