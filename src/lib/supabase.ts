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
 * O cliente de Auth do supabase-js usa o `fetch` global, não o wrapper que
 * já inclui `apikey`. Sem esse header o gateway responde
 * "No API key found in request" no cadastro/login.
 */
function fetchWithApiKey(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers)
    if (!headers.get('apikey')?.trim()) {
      headers.set('apikey', apiKey)
    }
    return fetch(input, { ...init, headers })
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
    return createClient(FALLBACK_URL, FALLBACK_KEY)
  } catch (error) {
    console.error('Não foi possível iniciar o cliente Supabase:', error)
    return createClient(FALLBACK_URL, FALLBACK_KEY)
  }
}

export const supabase: SupabaseClient = createSupabaseClient()
