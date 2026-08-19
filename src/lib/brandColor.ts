export const ORCAREAL_BRAND_COLOR = '#aa00ff'

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

const THEME_KEYS = [
  '--color-brand',
  '--color-brand-hover',
  '--color-brand-soft',
  '--color-navy-bright',
  '--color-navy-soft',
  '--color-navy-mid',
  '--shadow-soft',
] as const

export function parseBrandColor(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!HEX.test(trimmed)) return null
  if (trimmed.length === 4) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase()
  }
  return trimmed.toLowerCase()
}

export function resolveBrandColor(value: unknown): string {
  return parseBrandColor(value) ?? ORCAREAL_BRAND_COLOR
}

export function brandColorFromSettings(
  settings: Record<string, unknown> | null | undefined
): string | null {
  return parseBrandColor(settings?.brand_color)
}

function hexToRgb(hex: string) {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  }
}

function rgbToHex(r: number, g: number, b: number) {
  const to = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

function mix(
  hex: string,
  target: { r: number; g: number; b: number },
  amount: number
) {
  const rgb = hexToRgb(hex)
  return rgbToHex(
    rgb.r + (target.r - rgb.r) * amount,
    rgb.g + (target.g - rgb.g) * amount,
    rgb.b + (target.b - rgb.b) * amount
  )
}

export function deriveBrandTokens(value: unknown) {
  const color = resolveBrandColor(value)
  const rgb = hexToRgb(color)
  return {
    brand: color,
    brandHover: mix(color, { r: 0, g: 0, b: 0 }, 0.12),
    brandSoft: mix(color, { r: 255, g: 255, b: 255 }, 0.88),
    navyMid: mix(color, { r: 0, g: 0, b: 0 }, 0.28),
    shadowSoft: `0 18px 44px -26px rgb(${rgb.r} ${rgb.g} ${rgb.b} / 0.22)`,
  }
}

export function brandColorContrastWarning(value: unknown): string | null {
  const color = parseBrandColor(value)
  if (!color) return null
  const { r, g, b } = hexToRgb(color)
  const toLinear = (channel: number) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const luminance =
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
  const contrastOnWhite = 1.05 / (luminance + 0.05)
  if (contrastOnWhite < 3) {
    return 'Essa cor fica pouco visível em botões. Prefira um tom mais escuro.'
  }
  return null
}

export function applyCompanyBrand(value: unknown) {
  if (typeof document === 'undefined') return
  const parsed = parseBrandColor(value)
  if (!parsed || parsed === ORCAREAL_BRAND_COLOR) {
    clearCompanyBrand()
    return
  }
  const tokens = deriveBrandTokens(parsed)
  const root = document.documentElement
  root.style.setProperty('--color-brand', tokens.brand)
  root.style.setProperty('--color-brand-hover', tokens.brandHover)
  root.style.setProperty('--color-brand-soft', tokens.brandSoft)
  root.style.setProperty('--color-navy-bright', tokens.brand)
  root.style.setProperty('--color-navy-soft', tokens.brandSoft)
  root.style.setProperty('--color-navy-mid', tokens.navyMid)
  root.style.setProperty('--shadow-soft', tokens.shadowSoft)
}

export function clearCompanyBrand() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  for (const key of THEME_KEYS) {
    root.style.removeProperty(key)
  }
}
