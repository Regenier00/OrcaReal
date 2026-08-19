import { useState } from 'react'
import { Link } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { MISSING_SUPABASE_CONFIG_MESSAGE } from '@/lib/supabaseEnv'
import { mapAuthError } from '@/features/auth/authErrors'
import { MissingAuthConfigNotice } from '@/features/auth/MissingAuthConfigNotice'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
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
      const redirectTo = `${window.location.origin}/login`
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo }
      )

      if (resetError) {
        setError(mapAuthError(resetError.message))
        return
      }

      setMessage(
        'Se o e-mail existir, enviaremos um link para redefinir a senha.'
      )
    } catch (err) {
      console.error(err)
      setError('Ocorreu um erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-svh bg-paper">
      <div className="border-b border-paper-muted bg-white">
        <PublicHeader />
      </div>

      <div className="mx-auto max-w-md px-5 py-12">
        <h1 className="font-display text-3xl font-bold text-ink">
          Recuperar senha
        </h1>
        <p className="mt-2 text-sm text-mist">
          Informe seu e-mail para receber o link de redefinição.
        </p>

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
          <Button
            type="submit"
            disabled={loading || !isSupabaseConfigured}
            className="w-full"
          >
            {loading ? 'Enviando...' : 'Enviar link'}
          </Button>
        </form>

        {message ? <p className="mt-4 text-sm text-ok">{message}</p> : null}
        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

        <p className="mt-6 text-sm text-mist">
          <Link to="/login" className="font-semibold text-navy-bright hover:underline">
            Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  )
}
