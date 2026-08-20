import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createCompanyChartAccount,
  deleteCompanyChartAccount,
  listCompanyChartAccounts,
} from '@/features/erp/chartAccountService'
import { ERP_PATHS } from '@/features/erp/model'
import { MONEY_GROUPS } from '@/features/budget/model'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { CompanyChartAccount, MoneyGroup } from '@/types/database'

const GROUP_PREFIX_HINT: Record<MoneyGroup, string> = {
  revenue: 'Ex.: 3.1',
  cost: 'Ex.: 4.1',
  expense: 'Ex.: 4.2',
  investment: 'Ex.: 1.2',
}

const GROUP_QUESTION: Record<MoneyGroup, string> = {
  revenue: 'Qual prefixo das contas de receita?',
  cost: 'Qual prefixo das contas de custo?',
  expense: 'Qual prefixo das contas de despesa?',
  investment: 'Qual prefixo das contas de investimento?',
}

export function ChartAccountsTab({
  companyId,
  canEdit,
}: {
  companyId: string
  canEdit: boolean
}) {
  const [items, setItems] = useState<CompanyChartAccount[]>([])
  const [drafts, setDrafts] = useState<Record<MoneyGroup, string>>({
    revenue: '',
    cost: '',
    expense: '',
    investment: '',
  })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingGroup, setSavingGroup] = useState<MoneyGroup | null>(null)

  const reload = useCallback(async () => {
    const accounts = await listCompanyChartAccounts(companyId)
    if (!accounts.ok) {
      setError(accounts.message)
      return
    }
    setError('')
    setItems(accounts.data.filter((item) => item.match_kind === 'prefix'))
  }, [companyId])

  useEffect(() => {
    let mounted = true
    void listCompanyChartAccounts(companyId).then((accounts) => {
      if (!mounted) return
      if (!accounts.ok) {
        setError(accounts.message)
      } else {
        setError('')
        setItems(accounts.data.filter((item) => item.match_kind === 'prefix'))
      }
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [companyId])

  const byGroup = useMemo(() => {
    return MONEY_GROUPS.map((group) => ({
      group,
      prefixes: items
        .filter((item) => item.money_group === group.id)
        .sort((a, b) => a.account_code.localeCompare(b.account_code, 'pt-BR')),
    }))
  }, [items])

  const handleAddPrefix = async (moneyGroup: MoneyGroup) => {
    if (!canEdit || savingGroup) return
    const prefix = drafts[moneyGroup].trim()
    if (!prefix) {
      setError('Informe o prefixo usado pela empresa nesse grupo.')
      return
    }

    setSavingGroup(moneyGroup)
    setError('')
    setMessage('')
    const result = await createCompanyChartAccount({
      companyId,
      accountCode: prefix,
      accountName: `Prefixo ${groupLabel(moneyGroup)}`,
      matchKind: 'prefix',
      moneyGroup,
      destinationName: 'Centro de custo do arquivo',
      priority: 40,
    })
    setSavingGroup(null)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setDrafts((current) => ({ ...current, [moneyGroup]: '' }))
    setMessage(
      `Prefixo ${prefix} salvo em ${groupLabel(moneyGroup)}. No upload, contas com esse início serão apropriadas nesse grupo e o destino virá do centro de custo do arquivo.`,
    )
    await reload()
  }

  if (loading) {
    return <p className="text-sm text-mist">Carregando classificação...</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="font-display text-xl font-semibold text-navy">
            Classificação financeira
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-mist">
            Informe o prefixo que a empresa usa em cada grupo. No upload do
            realizado, contas com esse prefixo entram no grupo correspondente e o{' '}
            <span className="font-medium text-ink">destino</span> é o centro de
            custo que veio no arquivo.
          </p>
        </div>
        <Link
          to={ERP_PATHS.import}
          className="text-sm font-medium text-navy-bright hover:underline"
        >
          Importar realizado ERP
        </Link>
      </div>

      <div className="space-y-4">
        {byGroup.map(({ group, prefixes }) => (
          <section
            key={group.id}
            className="rounded-2xl border border-paper-muted bg-paper/30 px-4 py-4 sm:px-5"
          >
            <h3 className="font-display text-lg font-semibold text-navy">
              {group.label}
            </h3>
            <p className="mt-1 text-sm text-mist">{group.description}</p>
            <p className="mt-3 text-sm font-medium text-ink">
              {GROUP_QUESTION[group.id]}
            </p>

            {prefixes.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {prefixes.map((item) => (
                  <li
                    key={item.id}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm text-ink ring-1 ring-paper-muted"
                  >
                    <span className="font-mono font-medium">{item.account_code}</span>
                    {canEdit ? (
                      <button
                        type="button"
                        className="text-xs text-mist hover:text-danger"
                        aria-label={`Remover prefixo ${item.account_code}`}
                        onClick={() => {
                          void deleteCompanyChartAccount(item.id).then((result) => {
                            if (!result.ok) setError(result.message)
                            else void reload()
                          })
                        }}
                      >
                        Remover
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-mist">
                Nenhum prefixo cadastrado neste grupo.
              </p>
            )}

            {canEdit ? (
              <form
                className="mt-4 flex flex-wrap items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  void handleAddPrefix(group.id)
                }}
              >
                <div className="min-w-[10rem] flex-1">
                  <Input
                    label="Prefixo"
                    value={drafts[group.id]}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [group.id]: event.target.value,
                      }))
                    }
                    placeholder={GROUP_PREFIX_HINT[group.id]}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={savingGroup === group.id}
                  className="mb-0.5"
                >
                  {savingGroup === group.id ? 'Salvando…' : 'Adicionar prefixo'}
                </Button>
              </form>
            ) : null}
          </section>
        ))}
      </div>

      {!canEdit ? (
        <p className="text-sm text-mist">
          Somente administradores e membros podem editar os prefixos.
        </p>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {message ? <p className="text-sm text-ok">{message}</p> : null}
    </div>
  )
}

function groupLabel(group: MoneyGroup) {
  return MONEY_GROUPS.find((item) => item.id === group)?.label ?? group
}
