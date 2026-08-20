import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createCompanyChartAccount,
  deleteCompanyChartAccount,
  listCompanyChartAccounts,
  seedCompanyChartDefaults,
} from '@/features/erp/chartAccountService'
import { ERP_MONEY_GROUP_LABEL, ERP_PATHS } from '@/features/erp/model'
import { listCompanyBudgetDestinations } from '@/features/actual/actualService'
import { MONEY_GROUPS } from '@/features/budget/model'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type {
  BudgetDestination,
  ChartAccountMatchKind,
  CompanyChartAccount,
  MoneyGroup,
} from '@/types/database'

export function ChartAccountsTab({
  companyId,
  canEdit,
}: {
  companyId: string
  canEdit: boolean
}) {
  const [items, setItems] = useState<CompanyChartAccount[]>([])
  const [destinations, setDestinations] = useState<BudgetDestination[]>([])
  const [accountCode, setAccountCode] = useState('')
  const [accountName, setAccountName] = useState('')
  const [matchKind, setMatchKind] = useState<ChartAccountMatchKind>('exact')
  const [moneyGroup, setMoneyGroup] = useState<MoneyGroup | ''>('')
  const [destinationKey, setDestinationKey] = useState('')
  const [destinationName, setDestinationName] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [filterGroup, setFilterGroup] = useState<MoneyGroup | ''>('')

  const reload = useCallback(async () => {
    const [accounts, nextDestinations] = await Promise.all([
      listCompanyChartAccounts(companyId),
      listCompanyBudgetDestinations(companyId),
    ])
    if (!accounts.ok) {
      setError(accounts.message)
      return
    }
    setError('')
    setItems(accounts.data)
    setDestinations(nextDestinations)
  }, [companyId])

  useEffect(() => {
    let mounted = true
    void Promise.all([
      listCompanyChartAccounts(companyId),
      listCompanyBudgetDestinations(companyId),
    ]).then(([accounts, nextDestinations]) => {
      if (!mounted) return
      if (!accounts.ok) {
        setError(accounts.message)
      } else {
        setError('')
        setItems(accounts.data)
      }
      setDestinations(nextDestinations)
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [companyId])

  const destinationOptions = useMemo(() => {
    if (!moneyGroup) return []
    return destinations.filter((item) => item.money_group === moneyGroup)
  }, [destinations, moneyGroup])

  const grouped = useMemo(() => {
    const visible = filterGroup
      ? items.filter((item) => item.money_group === filterGroup)
      : items
    return MONEY_GROUPS.map((group) => ({
      group,
      accounts: visible.filter((item) => item.money_group === group.id),
    })).filter((row) => row.accounts.length > 0 || (!filterGroup && items.length === 0))
  }, [items, filterGroup])

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canEdit || saving) return
    if (!moneyGroup) {
      setError('Selecione o grupo (Receita, Custo, Despesa ou Investimento).')
      return
    }
    const selectedDestination = destinations.find(
      (item) => item.id === destinationKey,
    )
    const name =
      selectedDestination?.name?.trim() || destinationName.trim()
    if (!name) {
      setError('Informe o destino (ex.: Receitas operacionais).')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')
    const result = await createCompanyChartAccount({
      companyId,
      accountCode,
      accountName,
      matchKind,
      moneyGroup,
      destinationId: selectedDestination?.id ?? null,
      destinationName: name,
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setAccountCode('')
    setAccountName('')
    setDestinationKey('')
    setDestinationName('')
    setMessage(
      matchKind === 'exact'
        ? 'Conta mapeada. Nas próximas importações ela será apropriada automaticamente.'
        : 'Prefixo salvo. Contas com esse início receberão sugestão de classificação.',
    )
    await reload()
  }

  const handleSeed = async () => {
    if (!canEdit || seeding) return
    setSeeding(true)
    setError('')
    setMessage('')
    const result = await seedCompanyChartDefaults(companyId)
    setSeeding(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setMessage(
      `Estrutura inicial aplicada (${result.data} contas/prefixos ativos). Ajuste conforme o plano de contas da empresa.`,
    )
    await reload()
  }

  if (loading) {
    return <p className="text-sm text-mist">Carregando plano de contas...</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="font-display text-xl font-semibold text-navy">
            Classificação financeira
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-mist">
            Defina o plano de contas da empresa nos grupos{' '}
            <span className="font-medium text-ink">Receita</span>,{' '}
            <span className="font-medium text-ink">Custo</span>,{' '}
            <span className="font-medium text-ink">Despesa</span> e{' '}
            <span className="font-medium text-ink">Investimento</span>. Contas
            com código exato são apropriadas automaticamente no upload do
            realizado; prefixos e descrições só sugerem para confirmação.
          </p>
        </div>
        <Link to={ERP_PATHS.import} className="text-sm font-medium text-navy-bright hover:underline">
          Importar realizado ERP
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select
          label="Filtrar grupo"
          value={filterGroup}
          onChange={(event) =>
            setFilterGroup(event.target.value as MoneyGroup | '')
          }
        >
          <option value="">Todos</option>
          {MONEY_GROUPS.map((group) => (
            <option key={group.id} value={group.id}>
              {group.label}
            </option>
          ))}
        </Select>
        {canEdit ? (
          <div className="flex items-end">
            <Button
              type="button"
              variant="secondary"
              disabled={seeding}
              onClick={() => void handleSeed()}
            >
              {seeding ? 'Aplicando…' : 'Usar prefixos típicos'}
            </Button>
          </div>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl bg-paper px-4 py-3 text-sm text-mist">
          Nenhuma conta mapeada ainda. Cadastre códigos do ERP ou aplique os
          prefixos típicos (3 → Receita, 4.1 → Custo, 4.2 → Despesa, 1.2/1.3 →
          Investimento).
        </p>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ group, accounts }) =>
            accounts.length === 0 ? null : (
              <section key={group.id}>
                <h3 className="font-display text-base font-semibold text-navy">
                  {group.label}
                </h3>
                <p className="text-xs text-mist">{group.description}</p>
                <ul className="mt-3 divide-y divide-paper-muted">
                  {accounts.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <p className="font-medium text-ink">
                          <span className="font-mono text-sm">
                            {item.account_code}
                          </span>
                          {item.account_name ? (
                            <span className="text-ink-soft">
                              {' '}
                              · {item.account_name}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-xs text-mist">
                          {item.match_kind === 'exact'
                            ? 'Código exato · apropria no upload'
                            : 'Prefixo · sugere classificação'}
                          {' · '}
                          {item.destination_name}
                        </p>
                      </div>
                      {canEdit ? (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            void deleteCompanyChartAccount(item.id).then(
                              (result) => {
                                if (!result.ok) setError(result.message)
                                else void reload()
                              },
                            )
                          }}
                        >
                          Remover
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ),
          )}
        </div>
      )}

      {canEdit ? (
        <form
          onSubmit={(event) => void handleAdd(event)}
          className="grid max-w-3xl gap-3 rounded-2xl border border-paper-muted bg-paper/40 p-4 sm:grid-cols-2"
        >
          <h3 className="font-display text-lg font-semibold text-navy sm:col-span-2">
            Adicionar conta ou prefixo
          </h3>
          <Input
            label="Código / prefixo"
            value={accountCode}
            onChange={(event) => setAccountCode(event.target.value)}
            placeholder={matchKind === 'prefix' ? 'Ex.: 4.1' : 'Ex.: 3.1.01'}
            required
          />
          <Input
            label="Descrição (opcional)"
            value={accountName}
            onChange={(event) => setAccountName(event.target.value)}
            placeholder="Ex.: Vendas de mercadorias"
          />
          <Select
            label="Correspondência"
            value={matchKind}
            onChange={(event) =>
              setMatchKind(event.target.value as ChartAccountMatchKind)
            }
          >
            <option value="exact">Código exato (apropria automático)</option>
            <option value="prefix">Prefixo (só sugere)</option>
          </Select>
          <Select
            label="Grupo"
            value={moneyGroup}
            onChange={(event) => {
              setMoneyGroup(event.target.value as MoneyGroup | '')
              setDestinationKey('')
            }}
            required
          >
            <option value="">Selecione…</option>
            {MONEY_GROUPS.map((group) => (
              <option key={group.id} value={group.id}>
                {ERP_MONEY_GROUP_LABEL[group.id]}
              </option>
            ))}
          </Select>
          <Select
            label="Destino cadastrado"
            value={destinationKey}
            onChange={(event) => {
              setDestinationKey(event.target.value)
              const found = destinations.find(
                (item) => item.id === event.target.value,
              )
              if (found) setDestinationName(found.name)
            }}
            disabled={!moneyGroup}
          >
            <option value="">Novo / digitar abaixo…</option>
            {destinationOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Input
            label="Nome do destino"
            value={destinationName}
            onChange={(event) => setDestinationName(event.target.value)}
            placeholder="Ex.: Receitas operacionais"
            disabled={Boolean(destinationKey)}
          />
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar no plano de contas'}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-mist">
          Somente administradores e membros podem editar o plano de contas.
        </p>
      )}

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {message ? <p className="text-sm text-ok">{message}</p> : null}
    </div>
  )
}
