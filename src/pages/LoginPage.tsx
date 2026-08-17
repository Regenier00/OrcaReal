import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { MISSING_SUPABASE_CONFIG_MESSAGE } from '@/lib/supabaseEnv'
import { mapAuthError } from '@/features/auth/authErrors'
import { MissingAuthConfigNotice } from '@/features/auth/MissingAuthConfigNotice'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/app'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (!isSupabaseConfigured) {
        setMessage(MISSING_SUPABASE_CONFIG_MESSAGE)
        return
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setMessage(mapAuthError(error.message))
        return
      }
      navigate(from)
    } catch (error) {
      console.error(error)
      setMessage('Ocorreu um erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-svh bg-paper">
      <div className="bg-hero-atmosphere">
        <PublicHeader />
      </div>

      <div className="mx-auto max-w-md px-5 py-12">
        <h1 className="font-display text-3xl font-bold text-ink">Entrar</h1>
        <p className="mt-2 text-sm text-mist">Acesse sua conta OrcaReal.</p>

        <MissingAuthConfigNotice />

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <Input
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="current-password"
          />

          <div className="flex justify-end">
            <Link
              to="/recuperar-senha"
              className="text-sm font-medium text-navy-bright hover:underline"
            >
              Esqueci minha senha
            </Link>
          </div>

          <Button
            type="submit"
            disabled={loading || !isSupabaseConfigured}
            className="w-full"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        {message ? <p className="mt-4 text-sm text-danger">{message}</p> : null}

        <p className="mt-6 text-sm text-mist">
          Ainda não tem conta?{' '}
          <Link to="/cadastro" className="font-semibold text-navy-bright hover:underline">
            Cadastre-se
          </Link>
        </p>
      </div>
    </div>
  )
}
