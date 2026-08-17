function readErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message ?? '')
  }
  return ''
}

function readErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code: unknown }).code ?? '')
  }
  return ''
}

export function mapCompanyError(error: unknown): string {
  const message = readErrorMessage(error)
  const code = readErrorCode(error).toLowerCase()

  const normalized = message.toLowerCase()

  if (
    code === 'pgrst301' ||
    normalized.includes('não autenticado') ||
    normalized.includes('not authenticated') ||
    normalized.includes('jwt') ||
    normalized.includes('session') ||
    normalized.includes('expired')
  ) {
    return 'Sua sessão expirou. Entre novamente para continuar.'
  }

  if (
    code === '42501' ||
    normalized.includes('row-level security') ||
    normalized.includes('permission denied') ||
    normalized.includes('rls') ||
    normalized.includes('not allowed') ||
    normalized.includes('não tem permissão')
  ) {
    return 'Você não tem permissão para concluir esta operação.'
  }

  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('network request failed') ||
    normalized.includes('fetch failed')
  ) {
    return 'Falha de conexão. Verifique sua internet e tente de novo.'
  }

  if (
    normalized.includes('duplicate') ||
    normalized.includes('unique') ||
    normalized.includes('already exists') ||
    normalized.includes('já está cadastrada')
  ) {
    return 'Esta empresa já está cadastrada.'
  }

  if (normalized.includes('nome da empresa')) {
    return 'Informe o nome da empresa.'
  }

  if (normalized.includes('segmento')) {
    return 'Selecione o tipo de empresa ou segmento.'
  }

  if (normalized.includes('cnpj')) {
    return 'CNPJ inválido. Verifique os números informados.'
  }

  if (normalized.includes('empresa não encontrada')) {
    return 'Não foi possível localizar a empresa.'
  }

  return 'Não foi possível concluir a operação. Tente novamente em instantes.'
}
