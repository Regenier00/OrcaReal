/**
 * Garante que o wrapper de fetch sempre manda apikey (header + query),
 * que é o que o gateway exige no erro "No API key found in request".
 */
function withApiKeyQuery(input: string, apiKey: string): string {
  if (!/^https?:\/\//i.test(input)) return input
  const url = new URL(input)
  if (!url.searchParams.get('apikey')?.trim()) {
    url.searchParams.set('apikey', apiKey)
  }
  return url.toString()
}

function fetchWithApiKey(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers)
    headers.set('apikey', apiKey)
    const nextInput =
      typeof input === 'string' ? withApiKeyQuery(input, apiKey) : input
    return fetch(nextInput, { ...init, headers })
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const key = 'sb_publishable_test_abc'
const calls: Array<{ url: string; apikey: string | null }> = []

const originalFetch = globalThis.fetch
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const headers = new Headers(init?.headers)
  calls.push({ url: String(input), apikey: headers.get('apikey') })
  return Promise.resolve(new Response('{}', { status: 200 }))
}) as typeof fetch

try {
  const wrapped = fetchWithApiKey(key)
  await wrapped('https://abcdefghijklmnop.supabase.co/rest/v1/erp_imports', {
    method: 'POST',
    headers: { Authorization: 'Bearer user-jwt' },
  })
  await wrapped('https://abcdefghijklmnop.supabase.co/storage/v1/object/erp-imports/a.xlsx', {
    method: 'POST',
    headers: { apikey: '' },
  })

  assert(calls.length === 2, 'duas chamadas')
  assert(
    withApiKeyQuery('https//broken.supabase.co/auth/v1/token', key) ===
      'https//broken.supabase.co/auth/v1/token',
    'não reescreve URL relativa/malformada',
  )
  assert(
    calls.every((item) => item.apikey === key),
    'header apikey sempre forçado',
  )
  assert(
    calls.every((item) => item.url.includes(`apikey=${encodeURIComponent(key)}`) || item.url.includes(`apikey=${key}`)),
    'query apikey presente como fallback do gateway',
  )
  console.log('supabaseFetchApiKey tests ok')
} finally {
  globalThis.fetch = originalFetch
}
