export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

export function formatCnpj(value: string): string {
  const digits = onlyDigits(value).slice(0, 14)

  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  }
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  }

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

function checkDigit(base: string, weights: number[]): number {
  const sum = base.split('').reduce((total, char, index) => {
    return total + Number(char) * weights[index]
  }, 0)
  const rest = sum % 11
  return rest < 2 ? 0 : 11 - rest
}

export function isValidCnpj(value: string): boolean {
  const digits = onlyDigits(value)
  if (digits.length !== 14) return false
  if (/^(\d)\1{13}$/.test(digits)) return false

  const first = checkDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const second = checkDigit(
    `${digits.slice(0, 12)}${first}`,
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  )

  return digits.endsWith(`${first}${second}`)
}

export function cnpjValidationMessage(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const digits = onlyDigits(trimmed)
  if (digits.length !== 14) {
    return 'Informe um CNPJ com 14 dígitos.'
  }
  if (!isValidCnpj(digits)) {
    return 'CNPJ inválido. Verifique os números informados.'
  }
  return null
}
