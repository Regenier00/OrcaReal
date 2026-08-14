import { useEffect, useState } from 'react'
import { useAuth } from '@/features/auth/useAuth'
import {
  getUserProfile,
  updateUserProfile,
} from '@/features/auth/profileService'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function ProfilePage() {
  const { user, signOut } = useAuth()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!user) return
    void getUserProfile(user.id).then((profile) => {
      setName(profile?.name || user.user_metadata?.name || '')
    })
  }, [user])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user) return

    if (!name.trim()) {
      setMessage('O nome não pode ficar vazio.')
      return
    }

    setLoading(true)
    setMessage('')

    const profile = await updateUserProfile(user.id, name.trim())
    setLoading(false)

    if (!profile) {
      setMessage('Não foi possível atualizar o perfil.')
      return
    }

    setMessage('Perfil atualizado com sucesso!')
  }

  return (
    <div className="max-w-lg">
      <h1 className="font-display text-3xl font-bold text-ink">Meu perfil</h1>
      <p className="mt-2 text-sm text-mist">
        Dados de identidade separados da autenticação (Supabase Auth).
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <Input
          label="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input label="E-mail" value={user?.email || ''} disabled />

        <Button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : 'Salvar alterações'}
        </Button>
      </form>

      {message ? <p className="mt-4 text-sm text-navy-mid">{message}</p> : null}

      <div className="mt-10 border-t border-paper-muted pt-6">
        <Button variant="secondary" onClick={() => void signOut()}>
          Sair da conta
        </Button>
      </div>
    </div>
  )
}
