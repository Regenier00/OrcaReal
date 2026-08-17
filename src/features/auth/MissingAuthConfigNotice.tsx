import { isSupabaseConfigured } from '@/lib/supabase'

export function MissingAuthConfigNotice() {
  if (isSupabaseConfigured) return null

  return (
    <div
      role="status"
      className="mt-6 rounded-xl border border-paper-muted bg-white px-4 py-3 text-sm leading-relaxed text-ink-soft"
    >
      <p className="font-semibold text-ink">Autenticação ainda não configurada</p>
      <p className="mt-1 text-mist">
        Login e cadastro usam o Supabase. Crie um arquivo{' '}
        <code className="rounded bg-paper-muted px-1 py-0.5 text-[0.8em]">
          .env
        </code>{' '}
        na raiz do projeto (pode copiar de{' '}
        <code className="rounded bg-paper-muted px-1 py-0.5 text-[0.8em]">
          .env.example
        </code>
        ) com:
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-mist">
        <li>
          <code className="rounded bg-paper-muted px-1 py-0.5 text-[0.8em]">
            VITE_SUPABASE_URL
          </code>{' '}
          — Project URL em Settings → API
        </li>
        <li>
          <code className="rounded bg-paper-muted px-1 py-0.5 text-[0.8em]">
            VITE_SUPABASE_PUBLISHABLE_KEY
          </code>{' '}
          ou{' '}
          <code className="rounded bg-paper-muted px-1 py-0.5 text-[0.8em]">
            VITE_SUPABASE_ANON_KEY
          </code>{' '}
          — chave publishable ou anon
        </li>
      </ol>
      <p className="mt-2 text-mist">
        Depois reinicie o <code className="rounded bg-paper-muted px-1 py-0.5 text-[0.8em]">npm run dev</code>.
        A demonstração em{' '}
        <a href="/demo" className="font-medium text-navy-bright hover:underline">
          /demo
        </a>{' '}
        continua disponível sem essas variáveis.
      </p>
    </div>
  )
}
