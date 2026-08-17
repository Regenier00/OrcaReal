const PLACEHOLDER_PATTERN =
  /your-project|your-anon-key|your-publishable|placeholder\.supabase|public-anon-placeholder/i

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function firstRealValue(values: unknown[]): string {
  for (const value of values) {
    const trimmed = asString(value)?.trim() ?? ''
    if (trimmed && !PLACEHOLDER_PATTERN.test(trimmed)) {
      return trimmed
    }
  }
  return ''
}

/** Aceita os nomes do dashboard atual (publishable) e o JWT legado (anon). */
export function resolveSupabaseCredentials(env: Record<string, unknown>): {
  url: string
  key: string
} {
  return {
    url: firstRealValue([env.VITE_SUPABASE_URL, env.SUPABASE_URL]),
    key: firstRealValue([
      env.VITE_SUPABASE_ANON_KEY,
      env.VITE_SUPABASE_PUBLISHABLE_KEY,
      env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
      env.SUPABASE_ANON_KEY,
      env.SUPABASE_PUBLISHABLE_KEY,
    ]),
  }
}

export const MISSING_SUPABASE_CONFIG_MESSAGE =
  'Configuração de autenticação ausente. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY) no arquivo .env e reinicie o servidor.'
