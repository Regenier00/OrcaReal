import {
  clientSupabaseEnvFromImportMeta,
  looksLikeClientApiKey,
  looksLikeHttpUrl,
  normalizeSupabaseUrl,
  resolveSupabaseCredentials,
  unwrapEnvValue,
} from './supabaseEnv.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const SAMPLE_URL = 'https://abcdefghijklmnop.supabase.co'
const SAMPLE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIn0.sig'
const SAMPLE_PUBLISHABLE = 'sb_publishable_abc123_xyz789'

assert(unwrapEnvValue('  "abc"  ') === 'abc', 'remove aspas duplas e espaços')
assert(unwrapEnvValue("'abc'") === 'abc', 'remove aspas simples')
assert(unwrapEnvValue('Bearer eyJ.abc.sig') === 'eyJ.abc.sig', 'remove prefixo Bearer')
assert(
  unwrapEnvValue('https//abcdefghijklmnop.supabase.co') === SAMPLE_URL,
  'corrige typo https// sem os dois pontos'
)
assert(
  unwrapEnvValue(`\u200B${SAMPLE_URL}\uFEFF`) === SAMPLE_URL,
  'remove caracteres invisíveis que quebram DNS'
)
assert(
  normalizeSupabaseUrl('https//abcdefghijklmnop.supabase.co/auth/v1') === SAMPLE_URL,
  'normaliza typo e remove path colado por engano'
)

assert(looksLikeHttpUrl(SAMPLE_URL), 'aceita URL https do projeto')
assert(looksLikeHttpUrl('http://127.0.0.1:54321'), 'aceita URL local do CLI')
assert(!looksLikeHttpUrl(SAMPLE_PUBLISHABLE), 'chave não é URL')

assert(looksLikeClientApiKey(SAMPLE_PUBLISHABLE), 'aceita chave publishable')
assert(looksLikeClientApiKey(SAMPLE_ANON), 'aceita JWT anon')
assert(!looksLikeClientApiKey('sb_secret_abc_def'), 'recusa chave secret no front')
assert(
  !looksLikeClientApiKey(
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.sig'
  ),
  'recusa JWT service_role'
)
assert(!looksLikeClientApiKey('your-publishable-key'), 'recusa placeholder')
assert(!looksLikeClientApiKey(SAMPLE_URL), 'recusa URL no campo da chave')

assert(
  resolveSupabaseCredentials({
    VITE_SUPABASE_URL: SAMPLE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: SAMPLE_PUBLISHABLE,
  }).key === SAMPLE_PUBLISHABLE,
  'lê a chave publishable do dashboard novo'
)

assert(
  resolveSupabaseCredentials({
    VITE_SUPABASE_URL: SAMPLE_URL,
    VITE_SUPABASE_ANON_KEY: SAMPLE_ANON,
  }).key === SAMPLE_ANON,
  'lê a chave anon JWT legada'
)

assert(
  resolveSupabaseCredentials({
    SUPABASE_URL: SAMPLE_URL,
    SUPABASE_PUBLISHABLE_KEY: SAMPLE_PUBLISHABLE,
  }).url === SAMPLE_URL,
  'aceita aliases sem prefixo VITE_'
)

assert(
  resolveSupabaseCredentials({
    NEXT_PUBLIC_SUPABASE_URL: SAMPLE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: SAMPLE_ANON,
  }).key === SAMPLE_ANON,
  'aceita aliases NEXT_PUBLIC_ copiados de exemplos Next.js'
)

assert(
  resolveSupabaseCredentials({
    VITE_SUPABASE_URL: 'https://your-project.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'your-publishable-key',
  }).url === '' &&
    resolveSupabaseCredentials({
      VITE_SUPABASE_URL: 'https://your-project.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'your-publishable-key',
    }).key === '',
  'ignora placeholders do .env.example'
)

assert(
  resolveSupabaseCredentials({
    VITE_SUPABASE_URL: `"${SAMPLE_URL}"`,
    VITE_SUPABASE_PUBLISHABLE_KEY: `'${SAMPLE_PUBLISHABLE}'`,
  }).key === SAMPLE_PUBLISHABLE,
  'aceita valores colados com aspas'
)

assert(
  resolveSupabaseCredentials({
    VITE_SUPABASE_URL: 'https//abcdefghijklmnop.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: SAMPLE_PUBLISHABLE,
  }).url === SAMPLE_URL,
  'resolve URL mesmo com typo https//'
)

assert(
  resolveSupabaseCredentials({
    VITE_SUPABASE_URL: SAMPLE_URL,
    VITE_SUPABASE_ANON_KEY: SAMPLE_ANON,
    VITE_SUPABASE_PUBLISHABLE_KEY: SAMPLE_PUBLISHABLE,
  }).key === SAMPLE_PUBLISHABLE,
  'prefere a chave publishable quando as duas existem'
)

const fromImportMeta = resolveSupabaseCredentials(
  clientSupabaseEnvFromImportMeta({
    VITE_SUPABASE_URL: SAMPLE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: SAMPLE_PUBLISHABLE,
  })
)
assert(
  fromImportMeta.url === SAMPLE_URL && fromImportMeta.key === SAMPLE_PUBLISHABLE,
  'monta o env do client a partir de acessos estáticos do Vite'
)

console.log('supabaseEnv tests ok')
