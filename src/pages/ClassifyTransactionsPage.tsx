import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCompany } from '@/features/company/useCompany'
import {
  applyTransactionSuggestions,
  classifyActualTransactions,
  listActualTransactions,
  listBudgetedDestinations,
  listDestinationMatchPatterns,
} from '@/features/actual/actualService'
import {
  ACTUAL_PATHS,
  EDITABLE_TRANSACTION_TYPES,
  TRANSACTION_STATUS_LABEL,
  TRANSACTION_TYPE_LABEL,
  hasSuggestion,
} from '@/features/actual/model'
import {
  enrichTransactionSuggestion,
  usesCostCenterDestinations,
  type ClassificationSuggestionContext,
} from '@/features/actual/destinationSuggestions'
import type {
  ActualTransaction,
  ActualTransactionStatus,
  ActualTransactionType,
  BudgetDestination,
  MoneyGroup,
} from '@/types/database'
import { MONEY_GROUP_LABEL, MONEY_GROUPS } from '@/features/budget/model'
import { formatMoney } from '@/features/budget/money'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { ActualPageShell } from '@/components/actual/ActualPageShell'
import {
  FloatingNotice,
  SuggestionBalloon,
} from '@/components/actual/SuggestionBalloon'
import { cn } from '@/lib/utils'

function formatDate(value: string) {
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

function canApplySuggestion(item: ActualTransaction) {
  return (
    (item.status === 'pending' || item.status === 'ignored') && hasSuggestion(item)
  )
}

function suggestionLabel(item: ActualTransaction) {
  const enriched = enrichTransactionSuggestion(item, {
    destinations: [],
    patterns: [],
  })
  if (enriched.label) return enriched.label
  if (item.suggested_money_group) {
    return MONEY_GROUP_LABEL[item.suggested_money_group]
  }
  return 'Sugestão do histórico'
}

function appropriationLabel(item: ActualTransaction) {
  if (item.money_group && item.destination_name) {
    return `${MONEY_GROUP_LABEL[item.money_group]} › ${item.destination_name}`
  }
  if (item.money_group) return MONEY_GROUP_LABEL[item.money_group]
  return '—'
}

function withClientSuggestions(
  items: ActualTransaction[],
  context: ClassificationSuggestionContext
): ActualTransaction[] {
  return items.map((item) => {
    if (item.status !== 'pending' && item.status !== 'ignored') return item
    const enriched = enrichTransactionSuggestion(item, context)
    if (!enriched.moneyGroup && !enriched.destinationName) {
      if (!item.suggested_money_group && !item.suggested_destination_name) {
        return item
      }
      // Remove sugestão cujo destino não está no orçamento atual.
      return {
        ...item,
        suggested_money_group: null,
        suggested_destination_id: null,
        suggested_destination_name: null,
        suggestion_source: null,
      }
    }
    return {
      ...item,
      suggested_money_group: enriched.moneyGroup,
      suggested_destination_id: enriched.destinationId,
      suggested_destination_name: enriched.destinationName,
      suggestion_source:
        enriched.source === 'context'
          ? 'rule'
          : enriched.source === 'history' || enriched.source === 'rule'
            ? enriched.source
            : item.suggestion_source,
    }
  })
}

export function ClassifyTransactionsPage() {
  const [params] = useSearchParams()
  const importId = params.get('importacao') ?? ''
  const { company, companyProfile, segments } = useCompany()
  const [items, setItems] = useState<ActualTransaction[]>([])
  const [destinations, setDestinations] = useState<BudgetDestination[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [status, setStatus] = useState<ActualTransactionStatus | ''>('pending')
  const [search, setSearch] = useState('')
  const [moneyGroup, setMoneyGroup] = useState<MoneyGroup | ''>('')
  const [destinationKey, setDestinationKey] = useState('')
  const [includeUnbudgeted, setIncludeUnbudgeted] = useState(false)
  const [newDestinationName, setNewDestinationName] = useState('')
  const [nextType, setNextType] = useState<ActualTransactionType | ''>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)

  const loadKey = company
    ? `${company.id}:${importId}:${status}:${search}`
    : null

  const segmentCode = useMemo(() => {
    return segments.find((item) => item.id === companyProfile?.segment_id)?.code ?? null
  }, [segments, companyProfile])

  useEffect(() => {
    if (!company || !loadKey) return
    const companyId = company.id
    let mounted = true
    void Promise.all([
      listActualTransactions(companyId, {
        importId: importId || undefined,
        status,
        search,
      }),
      listBudgetedDestinations(companyId).catch(() => [] as BudgetDestination[]),
      listDestinationMatchPatterns(companyId),
    ])
      .then(([nextItems, nextDestinations, patterns]) => {
        if (!mounted) return
        const context: ClassificationSuggestionContext = {
          destinations: nextDestinations.map((item) => ({
            id: item.id,
            moneyGroup: item.money_group,
            name: item.name,
          })),
          patterns: patterns.map((item) => ({
            matchType: item.match_type,
            matchValue: item.match_value,
            moneyGroup: item.money_group,
            destinationId: item.destination_id,
            destinationName: item.destination_name,
            usageCount: item.usage_count,
          })),
          profileFacts: companyProfile?.profile_facts ?? {},
          segmentCode,
        }
        setDestinations(nextDestinations)
        setItems(withClientSuggestions(nextItems, context))
        setSelected([])
        setError('')
        setFetchedFor(loadKey)
      })
      .catch((err: unknown) => {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar movimentações.')
        setFetchedFor(loadKey)
      })
    return () => {
      mounted = false
    }
  }, [company, loadKey, importId, status, search, companyProfile, segmentCode])

  const loading = Boolean(loadKey) && fetchedFor !== loadKey
  const selectedItems = items.filter((item) => selected.includes(item.id))
  const selectedWithSuggestion = selectedItems.filter(canApplySuggestion)

  const destinationsForGroup = useMemo(
    () =>
      moneyGroup
        ? destinations.filter((item) => item.money_group === moneyGroup)
        : destinations,
    [destinations, moneyGroup]
  )

  const newDestinationLabel = usesCostCenterDestinations(moneyGroup)
    ? 'centro de custo'
    : 'destino'

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 4200)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    const suggested = items.filter(
      (item) => selected.includes(item.id) && canApplySuggestion(item),
    )
    if (suggested.length === 0) return
    const nextGroup = suggested[0]?.suggested_money_group ?? ''
    const nextDestination =
      suggested[0]?.suggested_destination_id ||
      suggested[0]?.suggested_destination_name ||
      ''
    const sameSuggestion = suggested.every(
      (item) =>
        (item.suggested_money_group ?? '') === nextGroup &&
        ((item.suggested_destination_id || item.suggested_destination_name || '') ===
          nextDestination),
    )
    const frame = window.requestAnimationFrame(() => {
      if (!sameSuggestion || !nextGroup) {
        setMoneyGroup('')
        setDestinationKey('')
        return
      }
      setMoneyGroup(nextGroup)
      setDestinationKey(
        suggested[0]?.suggested_destination_id ||
          suggested[0]?.suggested_destination_name ||
          '',
      )
    })
    return () => window.cancelAnimationFrame(frame)
  }, [items, selected])

  const suggestionPreview = useMemo(() => {
    if (selectedWithSuggestion.length === 0) return null
    const counts = new Map<string, number>()
    for (const item of selectedWithSuggestion) {
      const label = suggestionLabel(item)
      if (!label) continue
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    const lines = [...counts.entries()].map(([label, count]) =>
      selectedWithSuggestion.length > 1 && count > 1
        ? `${label} · ${count} lançamentos`
        : label,
    )
    if (lines.length === 0) return null
    const skipped = selectedItems.length - selectedWithSuggestion.length
    return {
      lines,
      hint:
        selectedWithSuggestion.length === 1
          ? 'Clique em Aplicar sugestão para apropriar com estes valores.'
          : skipped > 0
            ? `Cada lançamento segue a própria sugestão. ${skipped} sem sugestão ficam de fora.`
            : 'Cada lançamento será apropriado no grupo/destino da própria sugestão.',
    }
  }, [selectedItems.length, selectedWithSuggestion])

  const allSelected = items.length > 0 && selected.length === items.length

  const summary = useMemo(() => {
    return {
      pending: items.filter((item) => item.status === 'pending').length,
      classified: items.filter((item) => item.status === 'classified').length,
      withSuggestion: items.filter(hasSuggestion).length,
    }
  }, [items])

  const resolveDestination = () => {
    if (includeUnbudgeted) {
      const name = newDestinationName.trim()
      return {
        destinationId: null as string | null,
        destinationName: name || null,
      }
    }
    if (!destinationKey) return { destinationId: null, destinationName: null }
    const byId = destinations.find((item) => item.id === destinationKey)
    if (byId) {
      return { destinationId: byId.id, destinationName: byId.name }
    }
    return { destinationId: null, destinationName: destinationKey }
  }

  const reload = async () => {
    if (!company) return
    const [nextItems, nextDestinations, patterns] = await Promise.all([
      listActualTransactions(company.id, {
        importId: importId || undefined,
        status,
        search,
      }),
      listBudgetedDestinations(company.id).catch(() => [] as BudgetDestination[]),
      listDestinationMatchPatterns(company.id),
    ])
    const context: ClassificationSuggestionContext = {
      destinations: nextDestinations.map((item) => ({
        id: item.id,
        moneyGroup: item.money_group,
        name: item.name,
      })),
      patterns: patterns.map((item) => ({
        matchType: item.match_type,
        matchValue: item.match_value,
        moneyGroup: item.money_group,
        destinationId: item.destination_id,
        destinationName: item.destination_name,
        usageCount: item.usage_count,
      })),
      profileFacts: companyProfile?.profile_facts ?? {},
      segmentCode,
    }
    setDestinations(nextDestinations)
    setItems(withClientSuggestions(nextItems, context))
    setSelected((current) =>
      current.filter((id) => nextItems.some((item) => item.id === id)),
    )
  }

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  const apply = async (nextStatus: ActualTransactionStatus) => {
    if (!company || selected.length === 0) return
    const effectiveTypes = selectedItems.map((item) => nextType || item.type)
    if (
      nextStatus === 'classified' &&
      effectiveTypes.some((itemType) => itemType === 'unknown')
    ) {
      setError('Defina se o lançamento é entrada ou saída antes de apropriar.')
      return
    }
    if (nextStatus === 'classified' && !moneyGroup) {
      setError('Informe o grupo (Receitas, Custos, Despesas ou Investimentos) para apropriar.')
      return
    }
    if (nextStatus === 'classified' && includeUnbudgeted && !newDestinationName.trim()) {
      setError(
        `Informe o nome do ${newDestinationLabel} não orçado para incluir no orçamento.`,
      )
      return
    }
    const destination = resolveDestination()
    setBusy(true)
    try {
      await classifyActualTransactions({
        companyId: company.id,
        transactionIds: selected,
        moneyGroup: moneyGroup || null,
        destinationId: destination.destinationId,
        destinationName: destination.destinationName,
        includeUnbudgeted:
          nextStatus === 'classified' ? includeUnbudgeted : false,
        status: nextStatus,
        type: nextType || null,
      })
      await reload()
      setSelected([])
      setIncludeUnbudgeted(false)
      setNewDestinationName('')
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível classificar.')
    } finally {
      setBusy(false)
    }
  }

  const changeType = async (item: ActualTransaction, value: ActualTransactionType) => {
    if (!company || value === item.type) return
    setBusy(true)
    try {
      await classifyActualTransactions({
        companyId: company.id,
        transactionIds: [item.id],
        type: value,
        status: item.status === 'ignored' ? 'ignored' : item.status,
      })
      await reload()
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível alterar o tipo.')
    } finally {
      setBusy(false)
    }
  }

  const applySuggestions = async () => {
    if (!company) return
    const targets = selectedWithSuggestion
    if (targets.length === 0) {
      setError('Selecione um lançamento com sugestão de histórico ou contexto.')
      return
    }
    const labels = [
      ...new Set(targets.map((item) => suggestionLabel(item)).filter(Boolean)),
    ]
    setBusy(true)
    try {
      await applyTransactionSuggestions({
        companyId: company.id,
        transactions: targets,
      })
      await reload()
      setSelected([])
      setError('')
      setNotice(
        targets.length === 1 && labels[0]
          ? `Apropriado com a sugestão: ${labels[0]}`
          : `${targets.length} lançamentos apropriados, cada um na própria sugestão.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível aplicar as sugestões.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ActualPageShell
      title="Realizados não apropriados"
      tourId="actual-classify"
      description="Apropriar significa dizer a qual grupo e destino do orçamento o lançamento pertence. Só aparecem destinos e centros de custo já orçados; se for algo não previsto, use a opção de incluir no orçamento."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to={ACTUAL_PATHS.import}>
            <Button variant="secondary">Importar extrato</Button>
          </Link>
          <Link to="/app/orcado-realizado">
            <Button variant="secondary">Orçado × Realizado</Button>
          </Link>
        </div>
      }
    >
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Select
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value as ActualTransactionStatus | '')}
        >
          <option value="">Todos</option>
          <option value="pending">Não apropriados</option>
          <option value="classified">Apropriados</option>
          <option value="ignored">Ignorados</option>
        </Select>
        <Input
          label="Busca"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Descrição do lançamento"
        />
      </div>

      <section className="mt-6 rounded-2xl border border-paper-muted bg-white p-5">
        <p className="text-sm text-mist">
          {summary.pending} não apropriados nesta lista · {summary.classified} apropriados
          {summary.withSuggestion > 0
            ? ` · ${summary.withSuggestion} com sugestão`
            : ''}
          {selected.length > 0 ? ` · ${selected.length} selecionada(s)` : ''}
        </p>
        {suggestionPreview ? (
          <div className="mt-4 mb-1 flex justify-end">
            <SuggestionBalloon
              className="w-full max-w-md"
              pointer="right"
              title="Sugestão inteligente"
              lines={suggestionPreview.lines}
              hint={suggestionPreview.hint}
            />
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          <Select
            label="Grupo"
            value={moneyGroup}
            onChange={(event) => {
              setMoneyGroup(event.target.value as MoneyGroup | '')
              setDestinationKey('')
              setNewDestinationName('')
              setIncludeUnbudgeted(false)
            }}
          >
            <option value="">Selecionar</option>
            {MONEY_GROUPS.map((group) => (
              <option key={group.id} value={group.id}>
                {group.label}
              </option>
            ))}
          </Select>
          <Select
            label="Destino"
            hint={
              moneyGroup === 'cost' || moneyGroup === 'expense'
                ? 'Centros de custo já incluídos no orçamento'
                : moneyGroup === 'revenue' || moneyGroup === 'investment'
                  ? 'Destinos já incluídos no orçamento'
                  : 'Somente o que já está no orçamento'
            }
            value={includeUnbudgeted ? '' : destinationKey}
            onChange={(event) => {
              setIncludeUnbudgeted(false)
              setNewDestinationName('')
              setDestinationKey(event.target.value)
            }}
            disabled={includeUnbudgeted}
          >
            <option value="">Sem destino específico</option>
            {destinationsForGroup.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select
            label="Tipo"
            hint="Use para corrigir entrada ou saída"
            value={nextType}
            onChange={(event) =>
              setNextType(event.target.value as ActualTransactionType | '')
            }
          >
            <option value="">Manter o tipo de cada lançamento</option>
            <option value="expense">Saída</option>
            <option value="income">Entrada</option>
          </Select>
          <div className="flex flex-wrap items-end gap-2">
            <Button
              type="button"
              disabled={busy || selected.length === 0}
              onClick={() => void apply('classified')}
            >
              Apropriar
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy || selected.length === 0}
              onClick={() => void apply('ignored')}
            >
              Ignorar
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy || selectedWithSuggestion.length === 0}
              onClick={() => void applySuggestions()}
            >
              Aplicar sugestão
            </Button>
          </div>
        </div>
        {moneyGroup ? (
          <div className="mt-4 space-y-3">
            <label className="flex items-start gap-3 text-sm text-ink">
              <input
                type="checkbox"
                className="mt-1"
                checked={includeUnbudgeted}
                onChange={(event) => {
                  const checked = event.target.checked
                  setIncludeUnbudgeted(checked)
                  if (checked) {
                    setDestinationKey('')
                  } else {
                    setNewDestinationName('')
                  }
                }}
              />
              <span>
                Incluir {newDestinationLabel} não orçado
                <span className="mt-0.5 block text-xs text-mist">
                  Cadastra no orçamento ativo (valor zero) e apropria neste destino.
                  Use só quando o lançamento não estava previsto.
                </span>
              </span>
            </label>
            {includeUnbudgeted ? (
              <Input
                label={
                  usesCostCenterDestinations(moneyGroup)
                    ? 'Novo centro de custo'
                    : 'Novo destino'
                }
                hint={
                  usesCostCenterDestinations(moneyGroup)
                    ? 'Será criado como centro de custo e incluído no orçamento'
                    : 'Será incluído no orçamento ativo para não perder o realizado'
                }
                value={newDestinationName}
                onChange={(event) =>
                  setNewDestinationName(event.target.value.toLocaleUpperCase('pt-BR'))
                }
                placeholder={
                  usesCostCenterDestinations(moneyGroup)
                    ? 'Ex.: LOGÍSTICA'
                    : 'Ex.: VENDA DE SOJA'
                }
                className="text-sm tracking-wide"
              />
            ) : null}
          </div>
        ) : null}
      </section>

      {error ? (
        <p className="mt-4 rounded-xl border border-danger/20 bg-white px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-8 text-sm text-mist">Carregando movimentações...</p>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-paper-muted bg-white px-6 py-12 text-center">
          <p className="font-display text-xl font-semibold text-ink">
            Nenhuma movimentação neste filtro
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-mist">
            Importe um extrato no Realizado para ver os lançamentos ainda sem
            apropriação, ou limpe os filtros.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-paper-muted bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-paper text-[11px] uppercase tracking-wide text-mist">
              <tr>
                <th className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() =>
                      setSelected(allSelected ? [] : items.map((item) => item.id))
                    }
                    aria-label="Selecionar todas"
                  />
                </th>
                <th className="px-3 py-2.5 font-medium">Data</th>
                <th className="px-3 py-2.5 font-medium">Descrição</th>
                <th className="px-3 py-2.5 font-medium">Tipo</th>
                <th className="px-3 py-2.5 text-right font-medium">Valor</th>
                <th className="px-3 py-2.5 font-medium">Grupo / destino</th>
                <th className="px-3 py-2.5 font-medium">Sugestão</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className={cn(
                    'border-t border-paper-muted align-top',
                    selected.includes(item.id) && 'bg-navy-soft/70',
                  )}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      onChange={() => toggle(item.id)}
                      aria-label={`Selecionar ${item.description}`}
                    />
                  </td>
                  <td className="px-3 py-3 tabular-nums text-ink-soft">
                    {formatDate(item.posted_at)}
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-ink">{item.description}</p>
                    {item.counterparty ? (
                      <p className="mt-0.5 text-xs text-mist">{item.counterparty}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    <select
                      aria-label={`Tipo de ${item.description}`}
                      className="w-full min-w-32 rounded-lg border border-paper-muted bg-white px-2 py-1.5 text-sm text-ink outline-none focus:border-navy-bright focus:ring-2 focus:ring-navy-bright/20"
                      value={item.type}
                      disabled={busy}
                      onChange={(event) =>
                        void changeType(
                          item,
                          event.target.value as ActualTransactionType,
                        )
                      }
                    >
                      {EDITABLE_TRANSACTION_TYPES.map((value) => (
                        <option key={value} value={value}>
                          {TRANSACTION_TYPE_LABEL[value]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td
                    className={cn(
                      'px-3 py-3 text-right tabular-nums font-medium',
                      item.type === 'expense' ? 'text-danger' : 'text-ok',
                    )}
                  >
                    {item.type === 'expense' ? '−' : ''}
                    {formatMoney(item.amount)}
                  </td>
                  <td className="px-3 py-3 text-xs text-mist">
                    {appropriationLabel(item)}
                  </td>
                  <td className="px-3 py-3 text-xs text-navy">
                    {canApplySuggestion(item) ? suggestionLabel(item) : '—'}
                  </td>
                  <td className="px-3 py-3 text-xs font-medium text-ink-soft">
                    {TRANSACTION_STATUS_LABEL[item.status]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {notice ? (
        <FloatingNotice message={notice} onDismiss={() => setNotice('')} />
      ) : null}
    </ActualPageShell>
  )
}
