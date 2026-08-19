export const MISSING_API_KEY_REQUEST_MESSAGE =
  'O servidor de autenticação não recebeu a chave da API. Confira VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY) no .env, salve e reinicie o npm run dev.'

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
    normalized.includes('supabaseurl is required')
  ) {
    return 'Não foi possível conectar ao servidor de autenticação. Verifique a configuração.'
  }

  if (
    normalized.includes('no api key found') ||
    (normalized.includes('apikey') && normalized.includes('not found')) ||
    normalized.includes('invalid api key') ||
    normalized.includes('invalid authentication credentials')
  ) {
    return MISSING_API_KEY_REQUEST_MESSAGE
  }

  return extracted
}
