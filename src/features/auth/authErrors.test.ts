import {
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
  mapAuthError('Invalid API key') === MISSING_API_KEY_REQUEST_MESSAGE,
  'traduz chave inválida para o mesmo passo a passo'
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

console.log('authErrors tests ok')
