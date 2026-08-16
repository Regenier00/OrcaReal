export function mapAuthError(message: string): string {
  const normalized = message.toLowerCase()

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

  return message
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  )
}
