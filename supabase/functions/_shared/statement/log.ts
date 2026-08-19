const PREFIX = '[OrcaReal extrato]'

function emit(level: 'log' | 'warn' | 'error', message: string, detail?: unknown) {
  if (typeof console === 'undefined') return
  if (detail !== undefined) console[level](PREFIX, message, detail)
  else console[level](PREFIX, message)
}

export function statementLog(message: string, detail?: unknown) {
  emit('log', message, detail)
}

export function statementWarn(message: string, detail?: unknown) {
  emit('warn', message, detail)
}

export function statementError(message: string, detail?: unknown) {
  emit('error', message, detail)
}
