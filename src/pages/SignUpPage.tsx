import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { MISSING_SUPABASE_CONFIG_MESSAGE } from '@/lib/supabaseEnv'
import { ensureUserProfile } from '@/features/auth/profileService'
import { mapAuthError } from '@/features/auth/authErrors'
import { MissingAuthConfigNotice } from '@/features/auth/MissingAuthConfigNotice'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function SignUpPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const fromDemo = (location.state as { from?: string } | null)?.from === '/demo'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    if (!isSupabaseConfigured) {
      setError(MISSING_SUPABASE_CONFIG_MESSAGE)
      setLoading(false)
      return
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: `${window.location.origin}/app`,
        },
      })

      if (signUpError) {
        setError(mapAuthError(signUpError.message))
        return
      }

      // Supabase devolve user sem identities quando o e-mail já existe
      // (evita enumeração). Não é um cadastro novo.
      if (!data.user || (data.user.identities?.length ?? 0) === 0) {
        setError(
          'Este e-mail já está cadastrado. Tente entrar ou recuperar a senha.'
        )
        return
      }

      // Confirm email ligado: usuário criado, sem sessão até confirmar.
      if (!data.session) {
        setMessage(
          'Conta criada. Confirme o e-mail enviado para poder entrar.'
        )
        return
      }

      await ensureUserProfile(data.user.id, name, email)
      setMessage('Cadastro realizado com sucesso!')
      navigate('/app')
    } catch (err) {
      console.error(err)
      const fallback =
        err instanceof Error
          ? mapAuthError(err.message)
          : 'Ocorreu um erro inesperado.'
      setError(fallback)
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
        <h1 className="font-display text-3xl font-bold text-ink">Criar conta</h1>
        <p className="mt-2 text-sm text-mist">
          {fromDemo
            ? 'A demonstração continua disponível. Com a conta você cria a empresa e usa os seus números.'
            : 'Padrão simples de cadastro — depois você cria sua empresa.'}
        </p>

        <MissingAuthConfigNotice />

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <Input
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
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
            autoComplete="new-password"
            hint="Mínimo de 6 caracteres"
          />

          <Button
            type="submit"
            disabled={loading || !isSupabaseConfigured}
            className="mt-2 w-full"
          >
            {loading ? 'Criando...' : 'Cadastrar'}
          </Button>
        </form>

        {message ? <p className="mt-4 text-sm text-ok">{message}</p> : null}
        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

        <p className="mt-6 text-sm text-mist">
          Já tem conta?{' '}
          <Link to="/login" className="font-semibold text-navy-bright hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
