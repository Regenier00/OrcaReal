import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCompany } from '@/features/company/useCompany'
import { canClassifyErp } from '@/features/actual/permissions'
import { listCompanyBudgetDestinations } from '@/features/actual/actualService'
import { classifyErpEntries, listErpEntries } from '@/features/erp/erpService'
import {
  ERP_MONEY_GROUP_LABEL,
  ERP_PATHS,
} from '@/features/erp/model'
import { MONEY_GROUPS } from '@/features/budget/model'
import { formatMoney } from '@/features/budget/money'
import type {
  BudgetDestination,
  ErpEntry,
  ErpEntryStatus,
  MoneyGroup,
} from '@/types/database'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { ActualPageShell } from '@/components/actual/ActualPageShell'
import { cn } from '@/lib/utils'

function formatDate(value: string) {
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

function hasSuggestion(item: ErpEntry) {
  return Boolean(item.suggested_money_group || item.suggested_destination_name)
}

export function ReviewErpEntriesPage() {
  const [params] = useSearchParams()
  const importId = params.get('importacao') ?? ''
  const { company, activeMembership } = useCompany()
  const canClassify = canClassifyErp(activeMembership?.role)
  const [items, setItems] = useState<ErpEntry[]>([])
  const [destinations, setDestinations] = useState<BudgetDestination[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [status, setStatus] = useState<ErpEntryStatus | ''>('pending')
  const [search, setSearch] = useState('')
  const [moneyGroup, setMoneyGroup] = useState<MoneyGroup | ''>('')
  const [destinationKey, setDestinationKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)

  const loadKey = company
    ? `${company.id}:${importId}:${status}:${search}`
    : null

  useEffect(() => {
    if (!company || !loadKey) return
    const companyId = company.id
    let mounted = true
    void Promise.all([
      listErpEntries(companyId, {
        importId: importId || undefined,
        status: status || undefined,
        search: search || undefined,
      }),
      listCompanyBudgetDestinations(companyId),
    ])
      .then(([entries, nextDestinations]) => {
        if (!mounted) return
        setItems(entries)
        setDestinations(nextDestinations)
        setSelected([])
        setError('')
        setFetchedFor(loadKey)
      })
      .catch((err: unknown) => {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar.')
        setFetchedFor(loadKey)
      })
    return () => {
      mounted = false
    }
  }, [company, loadKey, importId, status, search])

  const destinationOptions = useMemo(() => {
    if (!moneyGroup) return []
    return destinations.filter((item) => item.money_group === moneyGroup)
  }, [destinations, moneyGroup])

  const selectedDestination = useMemo(() => {
    if (!destinationKey) return null
    return destinations.find((item) => item.id === destinationKey) ?? null
  }, [destinationKey, destinations])

  const loading = Boolean(loadKey) && fetchedFor !== loadKey
  const allSelected =
    items.length > 0 && items.every((item) => selected.includes(item.id))

  const toggleAll = () => {
    setSelected(allSelected ? [] : items.map((item) => item.id))
  }

  const toggleOne = (id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    )
  }

  const refresh = async () => {
    if (!company) return
    const entries = await listErpEntries(company.id, {
      importId: importId || undefined,
      status: status || undefined,
      search: search || undefined,
    })
    setItems(entries)
    setSelected([])
  }

  const handleClassify = async (saveRules = true) => {
    if (!company || selected.length === 0 || !moneyGroup) {
      setError('Selecione lançamentos e um grupo (Receita, Custo, Despesa ou Investimento).')
      return
    }
    setBusy(true)
    setError('')
    try {
      const destinationName =
        selectedDestination?.name ||
        destinationOptions.find((item) => item.id === destinationKey)?.name ||
        null
      await classifyErpEntries({
        companyId: company.id,
        entryIds: selected,
        moneyGroup,
        destinationId: selectedDestination?.id ?? (destinationKey || null),
        destinationName,
        status: 'classified',
        type: moneyGroup === 'revenue' ? 'income' : 'expense',
        saveRules,
      })
      setNotice(
        saveRules
          ? 'Classificação salva e regras da empresa atualizadas.'
          : 'Classificação salva.',
      )
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao classificar.')
    } finally {
      setBusy(false)
    }
  }

  const handleApplySuggestions = async () => {
    if (!company) return
    const withSuggestions = items.filter(
      (item) => selected.includes(item.id) && hasSuggestion(item),
    )
    if (withSuggestions.length === 0) {
      setError('Nenhum dos selecionados tem sugestão.')
      return
    }
    setBusy(true)
    setError('')
    try {
      for (const item of withSuggestions) {
        if (!item.suggested_money_group) continue
        await classifyErpEntries({
          companyId: company.id,
          entryIds: [item.id],
          moneyGroup: item.suggested_money_group,
          destinationId: item.suggested_destination_id,
          destinationName: item.suggested_destination_name,
          departmentId: item.suggested_department_id,
          costCenterId: item.suggested_cost_center_id,
          status: 'classified',
          type:
            item.suggested_money_group === 'revenue' ? 'income' : 'expense',
          saveRules: true,
        })
      }
      setNotice('Sugestões aplicadas e salvas como regras.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao aplicar sugestões.')
    } finally {
      setBusy(false)
    }
  }

  const handleIgnore = async () => {
    if (!company || selected.length === 0) return
    setBusy(true)
    try {
      await classifyErpEntries({
        companyId: company.id,
        entryIds: selected,
        status: 'ignored',
        saveRules: false,
      })
      setNotice('Lançamentos ignorados.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao ignorar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ActualPageShell
      title="Revisar ERP"
      description="Confirme a classificação dos lançamentos não mapeados. Contas do plano (código exato) já vêm apropriadas; prefixos e descrições só sugerem. Confirmações atualizam o plano de contas da empresa."
      actions={
        <Link to={ERP_PATHS.import}>
          <Button variant="secondary">Nova importação</Button>
        </Link>
      }
    >
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="grid gap-3 sm:grid-cols-3">
          <Select
            label="Status"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as ErpEntryStatus | '')
            }
          >
            <option value="">Todos</option>
            <option value="pending">Pendentes</option>
            <option value="classified">Classificados</option>
            <option value="ignored">Ignorados</option>
          </Select>
          <Input
            label="Busca"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Descrição, conta, centro de custo"
          />
          <Select
            label="Grupo"
            value={moneyGroup}
            onChange={(event) => {
              setMoneyGroup(event.target.value as MoneyGroup | '')
              setDestinationKey('')
            }}
          >
            <option value="">Selecione…</option>
            {MONEY_GROUPS.map((group) => (
              <option key={group.id} value={group.id}>
                {group.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid gap-3">
          <Select
            label="Destino"
            value={destinationKey}
            onChange={(event) => setDestinationKey(event.target.value)}
            disabled={!moneyGroup}
          >
            <option value="">Opcional…</option>
            {destinationOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={busy || !canClassify || selected.length === 0 || !moneyGroup}
          onClick={() => void handleClassify(true)}
        >
          Classificar e salvar regras
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy || !canClassify || selected.length === 0}
          onClick={() => void handleApplySuggestions()}
        >
          Aplicar sugestões
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy || !canClassify || selected.length === 0}
          onClick={() => void handleIgnore()}
        >
          Ignorar
        </Button>
        {!canClassify ? (
          <p className="w-full text-xs text-mist">
            Visualizadores não podem classificar lançamentos.
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-danger/20 bg-white px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-4 rounded-xl border border-ok/20 bg-ok-soft px-4 py-3 text-sm text-ok">
          {notice}
        </p>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-xl bg-white ring-1 ring-paper-muted">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-paper text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Selecionar todos"
                />
              </th>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Descrição</th>
              <th className="px-3 py-2">Conta</th>
              <th className="px-3 py-2">Centro de custo</th>
              <th className="px-3 py-2">Valor</th>
              <th className="px-3 py-2">Sugestão</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-6 text-ink-soft" colSpan={8}>
                  Carregando…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-ink-soft" colSpan={8}>
                  Nenhum lançamento encontrado.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const checked = selected.includes(item.id)
                return (
                  <tr
                    key={item.id}
                    className={cn(
                      'border-t border-paper-muted',
                      checked && 'bg-brand/5',
                    )}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(item.id)}
                        aria-label={`Selecionar ${item.description}`}
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {formatDate(item.posted_at)}
                    </td>
                    <td className="max-w-[240px] truncate px-3 py-2">
                      {item.description}
                    </td>
                    <td className="px-3 py-2 text-ink-soft">
                      {[item.account_code, item.account_name]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </td>
                    <td className="px-3 py-2 text-ink-soft">
                      {[item.cost_center_code, item.cost_center_name]
                        .filter(Boolean)
                        .join(' · ') ||
                        item.department_name ||
                        '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {formatMoney(item.amount)}
                      <span className="ml-1 text-xs text-ink-soft">
                        {item.entry_side === 'debit'
                          ? 'D'
                          : item.entry_side === 'credit'
                            ? 'C'
                            : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {item.suggested_money_group ? (
                        <span>
                          {ERP_MONEY_GROUP_LABEL[item.suggested_money_group]}
                          {item.suggested_destination_name
                            ? ` › ${item.suggested_destination_name}`
                            : ''}
                          {item.suggestion_source ? (
                            <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-mist">
                              {item.suggestion_source === 'chart'
                                ? 'Plano de contas'
                                : item.suggestion_source === 'prefix'
                                  ? 'Prefixo'
                                  : item.suggestion_source === 'heuristic'
                                    ? 'Descrição/heurística'
                                    : item.suggestion_source === 'history'
                                      ? 'Histórico'
                                      : 'Regra'}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {item.status === 'classified' && item.money_group
                        ? `${ERP_MONEY_GROUP_LABEL[item.money_group]}${
                            item.destination_name
                              ? ` › ${item.destination_name}`
                              : ''
                          }`
                        : item.status}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </ActualPageShell>
  )
}
