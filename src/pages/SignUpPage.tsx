import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { ensureUserProfile } from '@/features/auth/profileService'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function SignUpPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      })

      if (error) {
        setMessage(error.message)
        return
      }

      if (!data.user) {
        setMessage('Não foi possível criar o usuário.')
        return
      }

      await ensureUserProfile(data.user.id, name, email)
      setMessage('Cadastro realizado com sucesso!')
      navigate('/app')
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
        <h1 className="font-display text-3xl font-bold text-ink">Criar conta</h1>
        <p className="mt-2 text-sm text-mist">
          Padrão simples de cadastro — depois você cria sua empresa.
        </p>

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

          <Button type="submit" disabled={loading} className="mt-2 w-full">
            {loading ? 'Criando...' : 'Cadastrar'}
          </Button>
        </form>

        {message ? <p className="mt-4 text-sm text-navy-mid">{message}</p> : null}

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
