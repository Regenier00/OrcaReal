const PLACEHOLDER_PATTERN =
  /your-project|your-anon-key|your-publishable|placeholder\.supabase|public-anon-placeholder/i

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/** Remove aspas copiadas do dashboard e o prefixo Bearer colado por engano. */
export function unwrapEnvValue(value: string): string {
  let trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    trimmed = trimmed.slice(1, -1).trim()
  }
  if (/^bearer\s+/i.test(trimmed)) {
    trimmed = trimmed.replace(/^bearer\s+/i, '').trim()
  }
  return trimmed
}

export function looksLikeHttpUrl(value: string): boolean {
  return /^https?:\/\/[^\s]+$/i.test(value)
}

function decodeBase64Url(value: string): string {
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/')
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
    return globalThis.atob(padded + pad)
  } catch {
    return ''
  }
}

/**
 * Chave pública do cliente: JWT `anon` legado ou `sb_publishable_`.
 * Recusa `service_role` / `sb_secret_` — não podem ir no front.
 */
export function looksLikeClientApiKey(value: string): boolean {
  if (!value || PLACEHOLDER_PATTERN.test(value) || looksLikeHttpUrl(value)) {
    return false
  }
  if (value.startsWith('sb_secret_')) return false
  if (value.startsWith('sb_publishable_')) return true

  const parts = value.split('.')
  if (parts.length === 3 && parts[0].startsWith('eyJ')) {
    return !decodeBase64Url(parts[1]).includes('service_role')
  }
  return false
}

function firstRealValue(
  values: unknown[],
  isValid: (value: string) => boolean = (value) => !PLACEHOLDER_PATTERN.test(value)
): string {
  for (const value of values) {
    const trimmed = unwrapEnvValue(asString(value) ?? '')
    if (trimmed && isValid(trimmed)) {
      return trimmed
    }
  }
  return ''
}

const URL_KEYS = [
  'VITE_SUPABASE_URL',
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
] as const

const API_KEY_KEYS = [
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const

/** Aceita os nomes do dashboard atual (publishable) e o JWT legado (anon). */
export function resolveSupabaseCredentials(env: Record<string, unknown>): {
  url: string
  key: string
} {
  return {
    url: firstRealValue(
      URL_KEYS.map((name) => env[name]),
      (value) => looksLikeHttpUrl(value) && !PLACEHOLDER_PATTERN.test(value)
    ),
    key: firstRealValue(
      API_KEY_KEYS.map((name) => env[name]),
      looksLikeClientApiKey
    ),
  }
}

/**
 * Valores lidos com acesso estático a `import.meta.env.VITE_*`.
 * O Vite 8 só substitui essa forma literal — passar o objeto inteiro
 * deixa URL/chave `undefined` no build e o cadastro vai ao gateway sem `apikey`.
 */
export function clientSupabaseEnvFromImportMeta(viteEnv: {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
  VITE_SUPABASE_PUBLISHABLE_KEY?: string
  VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY?: string
}): Record<string, unknown> {
  return {
    VITE_SUPABASE_URL: viteEnv.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: viteEnv.VITE_SUPABASE_ANON_KEY,
    VITE_SUPABASE_PUBLISHABLE_KEY: viteEnv.VITE_SUPABASE_PUBLISHABLE_KEY,
    VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY: viteEnv.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
  }
}

export const MISSING_SUPABASE_CONFIG_MESSAGE =
  'Configuração de autenticação ausente. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY) no arquivo .env e reinicie o servidor.'
