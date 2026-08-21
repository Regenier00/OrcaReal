import {
  API_KEY_STRIPPED_MESSAGE,
  describeApiKeyFailure,
  enrichSupabaseError,
  INVALID_API_KEY_MESSAGE,
  mapAuthError,
  mapSupabaseError,
  MISSING_API_KEY_REQUEST_MESSAGE,
  readErrorMessage,
} from './authErrors.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

assert(
  mapAuthError(
    '{"hint":"No `apikey` request header or url param was found.","message":"No API key found in request"}'
  ) === MISSING_API_KEY_REQUEST_MESSAGE,
  'traduz o JSON cru do gateway sem apikey'
)

assert(
  mapAuthError('No API key found in request') === MISSING_API_KEY_REQUEST_MESSAGE,
  'traduz a mensagem extraída do Auth'
)

assert(
  mapAuthError('Invalid API key') === INVALID_API_KEY_MESSAGE,
  'chave inválida não mistura com "faltou configurar .env"'
)

assert(
  mapAuthError('Invalid login credentials') === 'E-mail ou senha incorretos.',
  'não mistura credenciais de login com erro de API key'
)

assert(
  mapSupabaseError({
    message:
      '{"hint":"No `apikey` request header or url param was found.","message":"No API key found in request"}',
  }) === MISSING_API_KEY_REQUEST_MESSAGE,
  'mapSupabaseError traduz objeto com JSON do gateway'
)

assert(
  mapSupabaseError(new Error('No API key found in request')) ===
    MISSING_API_KEY_REQUEST_MESSAGE,
  'mapSupabaseError traduz Error de importação ERP'
)

assert(
  readErrorMessage({ message: 'No API key found in request' }) ===
    'No API key found in request',
  'readErrorMessage lê message de objeto PostgREST'
)

assert(
  mapSupabaseError({}, 'Falha na importação.') === 'Falha na importação.',
  'mapSupabaseError usa fallback sem message'
)

const enriched = enrichSupabaseError(
  'No API key found in request',
  {
    configured: true,
    urlHost: 'abcdefghijklmnop.supabase.co',
    keyKind: 'publishable',
    keyFingerprint: 'sb_publishable_…xyz',
  },
)
assert(
  enriched.startsWith(API_KEY_STRIPPED_MESSAGE),
  'com runtime configurado, explica header removido em vez de culpar só o .env'
)
assert(
  enriched.includes('abcdefghijklmnop.supabase.co'),
  'mostra o host carregado em runtime'
)

assert(
  describeApiKeyFailure({
    configured: false,
    urlHost: null,
    keyKind: 'missing',
    keyFingerprint: null,
  }) === MISSING_API_KEY_REQUEST_MESSAGE,
  'sem config continua pedindo .env'
)

assert(
  mapAuthError('Failed to fetch').includes('DNS/rede'),
  'traduz falha de rede/DNS do login'
)

assert(
  mapAuthError('net::ERR_NAME_NOT_RESOLVED').includes('https://SEU_REF.supabase.co'),
  'traduz ERR_NAME_NOT_RESOLVED com orientação de URL'
)

console.log('authErrors tests ok')
