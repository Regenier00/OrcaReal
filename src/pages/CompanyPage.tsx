import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCompany } from '@/features/company/useCompany'
import {
  createCostCenter,
  createDepartment,
  deleteCostCenter,
  deleteDepartment,
  getCompanySettings,
  listCompanyMembers,
  listCostCenters,
  listDepartments,
  updateCompanyData,
  updateCompanySegment,
  updateCompanySettings,
} from '@/features/company/companyService'
import { cnpjValidationMessage, formatCnpj } from '@/features/company/cnpj'
import { SEGMENT_OPTIONS, type SegmentCode } from '@/features/company/segmentOptions'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/utils'
import type {
  CompanyMember,
  CompanySettings,
  CostCenter,
  Department,
} from '@/types/database'

type Tab = 'dados' | 'usuarios' | 'departamentos' | 'centros' | 'configuracoes'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'dados', label: 'Dados da empresa' },
  { id: 'usuarios', label: 'Usuários' },
  { id: 'departamentos', label: 'Departamentos' },
  { id: 'centros', label: 'Centros de custo' },
  { id: 'configuracoes', label: 'Configurações' },
]

function roleLabel(role: string) {
  if (role === 'owner' || role === 'admin') return 'Administrador'
  if (role === 'viewer') return 'Visualizador'
  return 'Membro'
}

export function CompanyPage() {
  const {
    activeCompany,
    companyProfile,
    segments,
    isAdmin,
    refresh,
  } = useCompany()
  const [tab, setTab] = useState<Tab>('dados')

  if (!activeCompany) return null

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-ink">Empresa</h1>
      <p className="mt-2 text-sm text-mist">
        Gerencie os dados, as pessoas e a estrutura de{' '}
        <span className="font-medium text-ink">
          {activeCompany.trade_name || activeCompany.name}
        </span>
        .
      </p>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              'whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition',
              tab === item.id
                ? 'bg-navy text-paper'
                : 'bg-white text-ink-soft hover:bg-paper-muted'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-paper-muted bg-white p-5 sm:p-7">
        {tab === 'dados' ? (
          <CompanyDataTab
            companyId={activeCompany.id}
            name={activeCompany.name}
            tradeName={activeCompany.trade_name ?? ''}
            document={activeCompany.document ?? ''}
            description={activeCompany.description ?? ''}
            segmentId={companyProfile?.segment_id ?? ''}
            customSegment={companyProfile?.custom_segment ?? ''}
            segments={segments}
            canEdit={isAdmin}
            onSaved={() => void refresh()}
          />
        ) : null}
        {tab === 'usuarios' ? (
          <UsersTab key={activeCompany.id} companyId={activeCompany.id} />
        ) : null}
        {tab === 'departamentos' ? (
          <DepartmentsTab
            key={activeCompany.id}
            companyId={activeCompany.id}
            canEdit={isAdmin}
          />
        ) : null}
        {tab === 'centros' ? (
          <CostCentersTab
            key={activeCompany.id}
            companyId={activeCompany.id}
            canEdit={isAdmin}
          />
        ) : null}
        {tab === 'configuracoes' ? (
          <SettingsTab
            key={activeCompany.id}
            companyId={activeCompany.id}
            canEdit={isAdmin}
          />
        ) : null}
      </div>
    </div>
  )
}

function CompanyDataTab({
  companyId,
  name,
  tradeName,
  document,
  description,
  segmentId,
  customSegment,
  segments,
  canEdit,
  onSaved,
}: {
  companyId: string
  name: string
  tradeName: string
  document: string
  description: string
  segmentId: string
  customSegment: string
  segments: Array<{ id: string; code: string; name: string }>
  canEdit: boolean
  onSaved: () => void
}) {
  const [formName, setFormName] = useState(name)
  const [formTradeName, setFormTradeName] = useState(tradeName)
  const [formDocument, setFormDocument] = useState(
    document ? formatCnpj(document) : ''
  )
  const [formDescription, setFormDescription] = useState(description)
  const [formSegmentId, setFormSegmentId] = useState(segmentId)
  const [formCustomSegment, setFormCustomSegment] = useState(customSegment)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const selectedCode = segments.find((item) => item.id === formSegmentId)?.code
  const orderedSegments = useMemo(() => {
    return SEGMENT_OPTIONS.map((option) => {
      const match = segments.find((item) => item.code === option.code)
      return match ? { ...option, id: match.id } : null
    }).filter((item): item is { code: SegmentCode; label: string; id: string } =>
      Boolean(item)
    )
  }, [segments])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canEdit || loading) return

    const trimmedName = formName.trim()
    if (!trimmedName) {
      setError('Informe o nome da empresa.')
      return
    }
    const documentMessage = cnpjValidationMessage(formDocument)
    if (documentMessage) {
      setError(documentMessage)
      return
    }

    setLoading(true)
    setError('')
    setMessage('')

    const companyResult = await updateCompanyData({
      companyId,
      name: trimmedName,
      tradeName: formTradeName,
      document: formDocument,
      description: formDescription,
    })

    if (!companyResult.ok) {
      setLoading(false)
      setError(companyResult.message)
      return
    }

    if (formSegmentId) {
      const segmentResult = await updateCompanySegment({
        companyId,
        segmentId: formSegmentId,
        customSegment: selectedCode === 'other' ? formCustomSegment : '',
      })
      if (!segmentResult.ok) {
        setLoading(false)
        setError(segmentResult.message)
        return
      }
    }

    setLoading(false)
    setMessage('Dados da empresa atualizados.')
    onSaved()
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex max-w-xl flex-col gap-4">
      <Input
        label="Nome da empresa"
        value={formName}
        onChange={(event) => setFormName(event.target.value)}
        disabled={!canEdit}
        required
      />
      <Input
        label="Nome fantasia"
        value={formTradeName}
        onChange={(event) => setFormTradeName(event.target.value)}
        disabled={!canEdit}
      />
      <Input
        label="CNPJ"
        value={formDocument}
        onChange={(event) => setFormDocument(formatCnpj(event.target.value))}
        disabled={!canEdit}
        placeholder="00.000.000/0000-00"
      />
      <Select
        label="Segmento"
        value={formSegmentId}
        onChange={(event) => setFormSegmentId(event.target.value)}
        disabled={!canEdit}
      >
        <option value="">Selecione</option>
        {orderedSegments.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </Select>
      {selectedCode === 'other' ? (
        <Input
          label="Segmento personalizado"
          value={formCustomSegment}
          onChange={(event) => setFormCustomSegment(event.target.value)}
          disabled={!canEdit}
        />
      ) : null}
      <Textarea
        label="Descrição"
        value={formDescription}
        onChange={(event) => setFormDescription(event.target.value)}
        disabled={!canEdit}
      />

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {message ? <p className="text-sm text-ok">{message}</p> : null}

      {canEdit ? (
        <Button type="submit" disabled={loading} className="w-fit">
          {loading ? 'Salvando...' : 'Salvar alterações'}
        </Button>
      ) : (
        <p className="text-sm text-mist">
          Somente administradores podem alterar os dados da empresa.
        </p>
      )}
    </form>
  )
}

function UsersTab({ companyId }: { companyId: string }) {
  const [members, setMembers] = useState<CompanyMember[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    void listCompanyMembers(companyId).then((result) => {
      if (!mounted) return
      if (!result.ok) {
        setError(result.message)
        setMembers([])
      } else {
        setError('')
        setMembers(result.data)
      }
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [companyId])

  if (loading) return <p className="text-sm text-mist">Carregando usuários...</p>
  if (error) return <p className="text-sm text-danger">{error}</p>

  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-navy">
        Usuários da empresa
      </h2>
      <p className="mt-1 text-sm text-mist">
        Quem criou a empresa entra automaticamente como administrador.
      </p>
      <ul className="mt-5 divide-y divide-paper-muted">
        {members.map((member) => (
          <li key={member.id} className="flex items-center justify-between gap-3 py-3">
            <div>
              <p className="font-medium text-ink">
                {member.profile?.name || 'Usuário'}
              </p>
              <p className="text-xs text-mist">{member.profile?.email}</p>
            </div>
            <span className="text-xs font-medium uppercase tracking-wide text-navy-bright">
              {roleLabel(member.role)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function DepartmentsTab({
  companyId,
  canEdit,
}: {
  companyId: string
  canEdit: boolean
}) {
  const [items, setItems] = useState<Department[]>([])
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    const result = await listDepartments(companyId)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setError('')
    setItems(result.data)
  }, [companyId])

  useEffect(() => {
    let mounted = true
    void listDepartments(companyId).then((result) => {
      if (!mounted) return
      if (!result.ok) {
        setError(result.message)
      } else {
        setError('')
        setItems(result.data)
      }
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [companyId])

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canEdit || saving) return
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Informe o nome do departamento.')
      return
    }
    setSaving(true)
    const result = await createDepartment({ companyId, name: trimmed })
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setName('')
    await reload()
  }

  if (loading) return <p className="text-sm text-mist">Carregando departamentos...</p>

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-navy">
          Departamentos
        </h2>
        <Link to="/app/configurar-ambiente" className="text-sm font-medium text-navy-bright hover:underline">
          Usar sugestões
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-mist">
          Nenhum departamento cadastrado. A empresa começa sem estrutura
          automática.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-paper-muted">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-3">
              <p className="font-medium text-ink">{item.name}</p>
              {canEdit ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    void deleteDepartment(item.id).then((result) => {
                      if (!result.ok) setError(result.message)
                      else void reload()
                    })
                  }}
                >
                  Remover
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <form onSubmit={(event) => void handleAdd(event)} className="mt-5 flex gap-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Novo departamento"
          />
          <Button type="submit" disabled={saving}>
            {saving ? 'Adicionando...' : 'Adicionar'}
          </Button>
        </form>
      ) : null}

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
    </div>
  )
}

function CostCentersTab({
  companyId,
  canEdit,
}: {
  companyId: string
  canEdit: boolean
}) {
  const [items, setItems] = useState<CostCenter[]>([])
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    const result = await listCostCenters(companyId)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setError('')
    setItems(result.data)
  }, [companyId])

  useEffect(() => {
    let mounted = true
    void listCostCenters(companyId).then((result) => {
      if (!mounted) return
      if (!result.ok) {
        setError(result.message)
      } else {
        setError('')
        setItems(result.data)
      }
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [companyId])

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canEdit || saving) return
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Informe o nome do centro de custo.')
      return
    }
    setSaving(true)
    const result = await createCostCenter({
      companyId,
      name: trimmed,
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setName('')
    await reload()
  }

  if (loading) return <p className="text-sm text-mist">Carregando centros de custo...</p>

  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-navy">
        Centros de custo
      </h2>
      <p className="mt-1 text-sm text-mist">
        O código é gerado automaticamente na ordem de criação (001, 002…).
      </p>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-mist">
          Nenhum centro de custo cadastrado ainda.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-paper-muted">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium text-ink">{item.name}</p>
                <p className="text-xs text-mist">{item.code || '—'}</p>
              </div>
              {canEdit ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    void deleteCostCenter(item.id).then((result) => {
                      if (!result.ok) setError(result.message)
                      else void reload()
                    })
                  }}
                >
                  Remover
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <form onSubmit={(event) => void handleAdd(event)} className="mt-5 flex gap-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nome"
          />
          <Button type="submit" disabled={saving}>
            {saving ? 'Adicionando...' : 'Adicionar'}
          </Button>
        </form>
      ) : null}

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
    </div>
  )
}

function SettingsTab({
  companyId,
  canEdit,
}: {
  companyId: string
  canEdit: boolean
}) {
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [locale, setLocale] = useState('pt-BR')
  const [currency, setCurrency] = useState('BRL')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    void getCompanySettings(companyId).then((result) => {
      if (!mounted) return
      if (!result.ok) {
        setError(result.message)
      } else if (result.data) {
        setSettings(result.data)
        setLocale(String(result.data.settings.locale ?? 'pt-BR'))
        setCurrency(String(result.data.settings.currency ?? 'BRL'))
      }
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [companyId])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canEdit || saving) return
    setSaving(true)
    setError('')
    setMessage('')
    const result = await updateCompanySettings({
      companyId,
      settings: {
        ...(settings?.settings ?? {}),
        locale: locale.trim() || 'pt-BR',
        currency: currency.trim() || 'BRL',
      },
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setSettings(result.data)
    setMessage('Configurações atualizadas.')
  }

  if (loading) return <p className="text-sm text-mist">Carregando configurações...</p>

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex max-w-xl flex-col gap-4">
      <h2 className="font-display text-xl font-semibold text-navy">
        Configurações
      </h2>
      <Input
        label="Idioma"
        value={locale}
        onChange={(event) => setLocale(event.target.value)}
        disabled={!canEdit}
      />
      <Input
        label="Moeda"
        value={currency}
        onChange={(event) => setCurrency(event.target.value)}
        disabled={!canEdit}
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {message ? <p className="text-sm text-ok">{message}</p> : null}
      {canEdit ? (
        <Button type="submit" disabled={saving} className="w-fit">
          {saving ? 'Salvando...' : 'Salvar configurações'}
        </Button>
      ) : (
        <p className="text-sm text-mist">
          Somente administradores podem alterar as configurações.
        </p>
      )}
    </form>
  )
}
