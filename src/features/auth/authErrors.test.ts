import { mapAuthError, MISSING_API_KEY_REQUEST_MESSAGE } from './authErrors.ts'

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

console.log('authErrors tests ok')
