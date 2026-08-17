import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createCompany } from '@/features/company/companyService'
import { useCompany } from '@/features/company/useCompany'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function CompanyPage() {
  const navigate = useNavigate()
  const { refreshCompanies, selectCompany } = useCompany()
  const [name, setName] = useState('')
  const [tradeName, setTradeName] = useState('')
  const [document, setDocument] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    const company = await createCompany({ name, tradeName, document })
    setLoading(false)

    if (!company) {
      setMessage(
        'Não foi possível criar a empresa. Verifique se as migrations e a função create_company_with_defaults estão aplicadas no Supabase.'
      )
      return
    }

    setMessage('Empresa criada com estrutura padrão.')
    await refreshCompanies()
    selectCompany(company.id)
    navigate('/app/orcamentos')
  }

  return (
    <div className="max-w-lg">
      <h1 className="font-display text-3xl font-bold text-ink">Criar empresa</h1>
      <p className="mt-2 text-sm text-mist">
        A criação inicializa perfil, settings, departamentos, centros de custo,
        categorias, funcionalidades e dashboard padrão em uma única transação.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <Input
          label="Razão social / nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="Nome fantasia"
          value={tradeName}
          onChange={(e) => setTradeName(e.target.value)}
        />
        <Input
          label="CNPJ / documento"
          value={document}
          onChange={(e) => setDocument(e.target.value)}
        />

        <Button type="submit" disabled={loading} className="mt-2">
          {loading ? 'Criando...' : 'Criar empresa'}
        </Button>
      </form>

      {message ? <p className="mt-4 text-sm text-navy-mid">{message}</p> : null}
    </div>
  )
}
