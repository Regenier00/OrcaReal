import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  clientSupabaseEnvFromImportMeta,
  resolveSupabaseCredentials,
} from '@/lib/supabaseEnv'

const { url: supabaseUrl, key: supabaseAnonKey } = resolveSupabaseCredentials(
  clientSupabaseEnvFromImportMeta({
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY:
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
  })
)

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  console.warn(
    'Variáveis VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY) não configuradas. Páginas públicas e a demonstração seguem disponíveis.'
  )
}

// createClient lança se a URL for vazia ou inválida — isso deixava o app em tela branca.
const FALLBACK_URL = 'https://placeholder.supabase.co'
const FALLBACK_KEY = 'public-anon-placeholder'

/**
 * Resumo seguro do que o bundle realmente carregou (sem expor a chave inteira).
 * Útil quando o .env local está ok, mas o app em execução (preview/deploy) não.
 */
export function getSupabaseRuntimeInfo(): {
  configured: boolean
  urlHost: string | null
  keyKind: 'publishable' | 'anon_jwt' | 'missing' | 'other'
  keyFingerprint: string | null
} {
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      configured: false,
      urlHost: null,
      keyKind: 'missing',
      keyFingerprint: null,
    }
  }

  let urlHost: string | null = null
  try {
    urlHost = new URL(supabaseUrl).host
  } catch {
    urlHost = supabaseUrl
  }

  const keyKind = supabaseAnonKey.startsWith('sb_publishable_')
    ? 'publishable'
    : supabaseAnonKey.startsWith('eyJ')
      ? 'anon_jwt'
      : 'other'

  const keyFingerprint =
    supabaseAnonKey.length <= 12
      ? supabaseAnonKey
      : `${supabaseAnonKey.slice(0, 14)}…${supabaseAnonKey.slice(-4)}`

  return {
    configured: true,
    urlHost,
    keyKind,
    keyFingerprint,
  }
}

function withApiKeyQuery(input: RequestInfo | URL, apiKey: string): RequestInfo | URL {
  try {
    const raw =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url

    // Nunca resolve URL relativa contra o origin do app — isso transformava
    // "https//projeto.supabase.co/..." em "http://localhost/.../https//..." e
    // quebrava auth com ERR_NAME_NOT_RESOLVED / Failed to fetch.
    if (!/^https?:\/\//i.test(raw)) return input

    const url = new URL(raw)
    if (!/supabase\.(co|in)|localhost|127\.0\.0\.1/i.test(url.hostname)) {
      return input
    }
    if (!url.searchParams.get('apikey')?.trim()) {
      url.searchParams.set('apikey', apiKey)
    }

    if (typeof input === 'string') return url.toString()
    if (input instanceof URL) return url
    return new Request(url.toString(), input)
  } catch {
    return input
  }
}

/**
 * Junta headers do Request (quando o input já é Request) com os do init.
 * Se só usássemos `init?.headers`, o fetch substituiria os headers do Request
 * e perderia Content-Type/Authorization — o PostgREST então vê body vazio e
 * responde PGRST202 "function without parameters".
 */
function mergeFetchHeaders(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
): Headers {
  const headers = new Headers()
  if (typeof Request !== 'undefined' && input instanceof Request) {
    input.headers.forEach((value, key) => {
      headers.set(key, value)
    })
  }
  new Headers(init?.headers).forEach((value, key) => {
    headers.set(key, value)
  })
  return headers
}

/**
 * O gateway do Supabase responde "No API key found in request" sem `apikey`
 * no header ou na query. Auth/Storage às vezes montam headers sem a chave;
 * forçamos header + query em todo fetch do cliente.
 */
function fetchWithApiKey(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = mergeFetchHeaders(input, init)
    // Sempre sobrescreve — evita apikey vazio/"undefined" deixado por wrappers.
    headers.set('apikey', apiKey)
    const nextInput = withApiKeyQuery(input, apiKey)
    return fetch(nextInput, { ...init, headers })
  }
}

function createConfiguredClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    global: {
      headers: { apikey: key },
      fetch: fetchWithApiKey(key),
    },
  })
}

function createSupabaseClient(): SupabaseClient {
  try {
    if (supabaseUrl && supabaseAnonKey) {
      return createConfiguredClient(supabaseUrl, supabaseAnonKey)
    }
    // Mesmo no fallback, envia `apikey` — o gateway responde
    // "No API key found in request" se o header faltar.
    return createConfiguredClient(FALLBACK_URL, FALLBACK_KEY)
  } catch (error) {
    console.error('Não foi possível iniciar o cliente Supabase:', error)
    return createConfiguredClient(FALLBACK_URL, FALLBACK_KEY)
  }
}

export const supabase: SupabaseClient = createSupabaseClient()
