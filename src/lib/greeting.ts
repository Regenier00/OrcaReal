const SAO_PAULO = 'America/Sao_Paulo'

export function hourInSaoPaulo(now = new Date()) {
  const hour = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hourCycle: 'h23',
    timeZone: SAO_PAULO,
  }).formatToParts(now).find((part) => part.type === 'hour')?.value

  const parsed = Number(hour)
  return Number.isFinite(parsed) ? parsed : now.getHours()
}

export function dayGreeting(now = new Date()) {
  const hour = hourInSaoPaulo(now)
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function greetingFirstName(
  fullName?: string | null,
  email?: string | null
) {
  const fromName = fullName?.trim().split(/\s+/)[0]
  if (fromName) return fromName
  const fromEmail = email?.split('@')[0]?.trim()
  return fromEmail || ''
}

export function monthResultGreeting(
  fullName?: string | null,
  email?: string | null,
  now = new Date()
) {
  const hello = dayGreeting(now)
  const name = greetingFirstName(fullName, email)
  if (name) {
    return `${hello} ${name}, veja como está o resultado financeiro no mês.`
  }
  return `${hello}, veja como está o resultado financeiro no mês.`
}
