import type { BudgetPeriodKind } from '@/types/database'

export const MONTH_LABELS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const

export const MONTH_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const

export interface BudgetMonth {
  year: number
  month: number
  key: string
  label: string
  fullLabel: string
}

export function currentFiscalYear(now = new Date()) {
  return now.getFullYear()
}

export function periodLabelForYear(year: number) {
  return `${year}/${year + 1}`
}

export function defaultBudgetName(year: number) {
  return `Orçamento ${periodLabelForYear(year)}`
}

export function calendarYearBounds(year: number) {
  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  }
}

export function inferPeriodKind(
  year: number,
  startDate: string,
  endDate: string
): BudgetPeriodKind {
  const bounds = calendarYearBounds(year)
  return startDate === bounds.startDate && endDate === bounds.endDate
    ? 'calendar_year'
    : 'custom'
}

export function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || month < 1 || month > 12 || day < 1) return null
  return { year, month, day }
}

export function monthsBetween(startDate: string, endDate: string): BudgetMonth[] {
  const start = parseIsoDate(startDate)
  const end = parseIsoDate(endDate)
  if (!start || !end) return []

  const months: BudgetMonth[] = []
  let year = start.year
  let month = start.month

  while (year < end.year || (year === end.year && month <= end.month)) {
    months.push({
      year,
      month,
      key: monthKey(year, month),
      label: MONTH_SHORT[month - 1],
      fullLabel: `${MONTH_LABELS[month - 1]}/${year}`,
    })
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
    if (months.length > 36) break
  }

  return months
}

export function formatPeriodRange(startDate: string, endDate: string) {
  const months = monthsBetween(startDate, endDate)
  if (months.length === 0) return 'Período inválido'
  const first = months[0]
  const last = months[months.length - 1]
  return `${first.fullLabel} até ${last.fullLabel}`
}
