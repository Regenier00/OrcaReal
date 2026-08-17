import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { resolveSupabaseCredentials } from '@/lib/supabaseEnv'

const { url: supabaseUrl, key: supabaseAnonKey } = resolveSupabaseCredentials(
  import.meta.env as unknown as Record<string, unknown>
)

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  console.warn(
    'Variáveis VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY) não configuradas. Páginas públicas e a demonstração seguem disponíveis.'
  )
}

// createClient lança se a URL for vazia — isso deixava o app inteiro em tela branca.
const FALLBACK_URL = 'https://placeholder.supabase.co'
const FALLBACK_KEY = 'public-anon-placeholder'

export const supabase: SupabaseClient = createClient(
  supabaseUrl || FALLBACK_URL,
  supabaseAnonKey || FALLBACK_KEY
)
