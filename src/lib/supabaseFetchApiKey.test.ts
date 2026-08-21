/**
 * Garante que o wrapper de fetch sempre manda apikey (header + query),
 * que é o que o gateway exige no erro "No API key found in request".
 * Também preserva Content-Type/Authorization quando o input é Request.
 */
function withApiKeyQuery(input: string, apiKey: string): string {
  if (!/^https?:\/\//i.test(input)) return input
  const url = new URL(input)
  if (!url.searchParams.get('apikey')?.trim()) {
    url.searchParams.set('apikey', apiKey)
  }
  return url.toString()
}

function mergeFetchHeaders(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
): Headers {
  const headers = new Headers()
  if (typeof Request !== 'undefined' && input instanceof Request) {
    input.headers.forEach((value, key) => {
      headers.set(key, value)
    })
  }
  new Headers(init?.headers).forEach((value, key) => {
    headers.set(key, value)
  })
  return headers
}

function fetchWithApiKey(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = mergeFetchHeaders(input, init)
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
const calls: Array<{
  url: string
  apikey: string | null
  contentType: string | null
  authorization: string | null
  body: unknown
}> = []

const originalFetch = globalThis.fetch
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const headers = new Headers(init?.headers)
  calls.push({
    url: String(input instanceof Request ? input.url : input),
    apikey: headers.get('apikey'),
    contentType: headers.get('content-type'),
    authorization: headers.get('authorization'),
    body: init?.body ?? (input instanceof Request ? '(request-body)' : null),
  })
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
  await wrapped(
    new Request('https://abcdefghijklmnop.supabase.co/rest/v1/rpc/import_erp_entries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer user-jwt',
      },
      body: JSON.stringify({
        p_company_id: '00000000-0000-0000-0000-000000000001',
        p_import_id: '00000000-0000-0000-0000-000000000002',
        p_entries: [],
      }),
    }),
  )

  assert(calls.length === 3, 'três chamadas')
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
    calls.slice(0, 2).every(
      (item) =>
        item.url.includes(`apikey=${encodeURIComponent(key)}`) ||
        item.url.includes(`apikey=${key}`),
    ),
    'query apikey presente como fallback do gateway',
  )
  assert(
    calls[2]?.contentType === 'application/json',
    'Request input preserva Content-Type (evita PGRST202 without parameters)',
  )
  assert(
    calls[2]?.authorization === 'Bearer user-jwt',
    'Request input preserva Authorization',
  )
  console.log('supabaseFetchApiKey tests ok')
} finally {
  globalThis.fetch = originalFetch
}
