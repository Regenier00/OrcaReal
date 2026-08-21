export const MISSING_API_KEY_REQUEST_MESSAGE =
  'O Supabase não recebeu a chave da API (apikey). Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY) no .env ou nas variáveis de build, salve e reinicie o npm run dev (ou faça um novo deploy).'

export const INVALID_API_KEY_MESSAGE =
  'A chave do Supabase foi rejeitada. Confira se a URL e a chave (publishable ou anon) são do mesmo projeto, sem aspas extras, e reinicie o servidor / faça um novo deploy.'

export const API_KEY_STRIPPED_MESSAGE =
  'O app tem URL/chave carregadas, mas o gateway não recebeu o header apikey. Veja no DevTools → Network se a requisição para *.supabase.co inclui o header apikey (ou parâmetro ?apikey=). Extensão, proxy ou preview sem as variáveis de build costumam causar isso.'

function extractAuthMessage(message: string): string {
  const trimmed = message.trim()
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { message?: unknown }
      if (typeof parsed.message === 'string' && parsed.message.trim()) {
        return parsed.message
      }
    } catch {
      return message
    }
  }
  return message
}

/** Lê `message` de Error, Postgrest/Storage ou JSON cru do gateway. */
export function readErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message: unknown }).message
    if (typeof message === 'string') return message
    if (message != null) return String(message)
  }
  return ''
}

function isMissingApiKeyMessage(normalized: string): boolean {
  return (
    normalized.includes('no api key found') ||
    (normalized.includes('apikey') && normalized.includes('not found'))
  )
}

function isInvalidApiKeyMessage(normalized: string): boolean {
  return (
    normalized.includes('invalid api key') ||
    normalized.includes('invalid authentication credentials') ||
    normalized.includes('invalid jwt')
  )
}

/** Traduz erros do Supabase (auth, REST, storage, RPC) para mensagem amigável. */
export function mapSupabaseError(
  error: unknown,
  fallback = 'Não foi possível concluir a operação. Tente novamente.',
): string {
  const message = readErrorMessage(error).trim()
  if (!message) return fallback
  const mapped = mapAuthError(message)
  return mapped.trim() || fallback
}

export function mapAuthError(message: string): string {
  const extracted = extractAuthMessage(message)
  const normalized = extracted.toLowerCase()

  if (
    normalized.includes('already registered') ||
    normalized.includes('user already')
  ) {
    return 'Este e-mail já está cadastrado. Tente entrar ou recuperar a senha.'
  }

  if (normalized.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar. Verifique a caixa de entrada.'
  }

  if (normalized.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos.'
  }

  if (normalized.includes('signups not allowed')) {
    return 'O cadastro de novos usuários está desativado no servidor.'
  }

  if (normalized.includes('email signups are disabled')) {
    return 'O cadastro por e-mail está desativado no servidor.'
  }

  if (
    normalized.includes('rate limit') ||
    normalized.includes('only request this after')
  ) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'
  }

  if (
    normalized.includes('error sending confirmation') ||
    normalized.includes('confirmation email')
  ) {
    return 'Não foi possível enviar o e-mail de confirmação. Tente de novo em instantes.'
  }

  if (
    normalized.includes('password') &&
    (normalized.includes('6') || normalized.includes('least'))
  ) {
    return 'A senha precisa ter no mínimo 6 caracteres.'
  }

  if (
    normalized.includes('invalid format') ||
    normalized.includes('unable to validate email')
  ) {
    return 'Informe um e-mail válido.'
  }

  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('supabaseurl is required') ||
    normalized.includes('err_name_not_resolved') ||
    normalized.includes('name_not_resolved') ||
    normalized.includes('getaddrinfo') ||
    normalized.includes('enotfound')
  ) {
    return 'Não foi possível alcançar o Supabase (DNS/rede). Confira se VITE_SUPABASE_URL está como https://SEU_REF.supabase.co (com ://), abra essa URL no navegador e reinicie o npm run dev. VPN, adblock ou DNS local também podem bloquear.'
  }

  if (isMissingApiKeyMessage(normalized)) {
    return MISSING_API_KEY_REQUEST_MESSAGE
  }

  if (isInvalidApiKeyMessage(normalized)) {
    return INVALID_API_KEY_MESSAGE
  }

  return extracted
}

/** Mensagem de apikey enriquecida com o que o app realmente carregou em runtime. */
export function describeApiKeyFailure(runtime: {
  configured: boolean
  urlHost: string | null
  keyKind: string
  keyFingerprint: string | null
}): string {
  if (!runtime.configured) return MISSING_API_KEY_REQUEST_MESSAGE
  return `${API_KEY_STRIPPED_MESSAGE} Runtime: ${runtime.urlHost ?? 'sem-host'} · ${runtime.keyKind} · ${runtime.keyFingerprint ?? 'sem-chave'}.`
}

export function enrichSupabaseError(
  error: unknown,
  runtime: {
    configured: boolean
    urlHost: string | null
    keyKind: string
    keyFingerprint: string | null
  },
  fallback = 'Não foi possível concluir a operação. Tente novamente.',
): string {
  const raw = readErrorMessage(error)
  const normalized = extractAuthMessage(raw).toLowerCase()
  if (isMissingApiKeyMessage(normalized)) {
    return describeApiKeyFailure(runtime)
  }
  return mapSupabaseError(error, fallback)
}
