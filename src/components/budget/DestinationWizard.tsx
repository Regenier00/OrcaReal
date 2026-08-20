import { useMemo, useState } from 'react'
import type { DraftBudget, DraftBudgetItem, MoneyGroup } from '@/features/budget/model'
import {
  createDestinationItem,
  distributeAmounts,
  groupAllocatedTotal,
  groupItems,
  groupRemaining,
  lineTotal,
  MONEY_GROUP_LABEL,
  MONEY_GROUPS,
} from '@/features/budget/model'
import type { BudgetMonth } from '@/features/budget/period'
import { formatMoney, roundMoney } from '@/features/budget/money'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface GroupTotalsStepProps {
  draft: DraftBudget
  onChangeTotal: (moneyGroup: MoneyGroup, total: number) => void
}

export function GroupTotalsStep({ draft, onChangeTotal }: GroupTotalsStepProps) {
  return (
    <section className="rounded-2xl border border-paper-muted bg-white p-6">
      <h2 className="font-display text-xl font-semibold text-ink">
        Para onde o dinheiro vai
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-mist">
        Aqui é onde você define para onde seu dinheiro vai. Comece pelos quatro
        grupos fixos e diga quanto quer orçar em cada um neste período.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {MONEY_GROUPS.map((group) => {
          const current =
            draft.groupTotals.find((entry) => entry.moneyGroup === group.id)?.total ??
            0
          return (
            <article
              key={group.id}
              className={cn(
                'rounded-2xl border p-4 transition',
                current > 0
                  ? 'border-navy-bright/40 bg-navy-soft/40'
                  : 'border-paper-muted bg-paper/40'
              )}
            >
              <h3 className="font-display text-lg font-semibold text-ink">
                {group.label}
              </h3>
              <p className="mt-1 text-sm text-mist">{group.description}</p>
              <div className="mt-4">
                <MoneyInput
                  label={group.question}
                  value={current}
                  onChange={(value) => onChangeTotal(group.id, value)}
                  className="!rounded-xl !px-3.5 !py-2.5 !text-base"
                />
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

interface DestinationEditorProps {
  draft: DraftBudget
  months: BudgetMonth[]
  moneyGroup: MoneyGroup
  onChangeItems: (items: DraftBudgetItem[]) => void
}

export function DestinationEditor({
  draft,
  months,
  moneyGroup,
  onChangeItems,
}: DestinationEditorProps) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState(0)
  const [error, setError] = useState('')

  const items = groupItems(draft.items, moneyGroup)
  const planned =
    draft.groupTotals.find((group) => group.moneyGroup === moneyGroup)?.total ?? 0
  const allocated = groupAllocatedTotal(draft.items, moneyGroup, months)
  const remaining = groupRemaining(draft, moneyGroup, months)
  const label = MONEY_GROUP_LABEL[moneyGroup]

  const replaceGroupItems = (nextGroupItems: DraftBudgetItem[]) => {
    const others = draft.items.filter((item) => item.moneyGroup !== moneyGroup)
    onChangeItems([...others, ...nextGroupItems])
  }

  const addDestination = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Informe o nome do destino.')
      return
    }
    if (amount <= 0) {
      setError('Informe um valor maior que zero para o destino.')
      return
    }
    if (
      items.some(
        (item) => item.destinationName.trim().toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      setError('Já existe um destino com este nome neste grupo.')
      return
    }
    if (roundMoney(amount) > roundMoney(remaining + 0.001)) {
      setError(
        `Só restam ${formatMoney(Math.max(remaining, 0))} para distribuir em ${label}.`
      )
      return
    }

    replaceGroupItems([
      ...items,
      createDestinationItem(months, moneyGroup, trimmed, amount),
    ])
    setName('')
    setAmount(0)
    setError('')
  }

  const updateDestinationAmount = (localId: string, total: number) => {
    replaceGroupItems(
      items.map((item) =>
        item.localId === localId
          ? { ...item, amounts: distributeAmounts(total, months) }
          : item
      )
    )
  }

  const updateDestinationName = (localId: string, nextName: string) => {
    replaceGroupItems(
      items.map((item) =>
        item.localId === localId
          ? { ...item, destinationName: nextName }
          : item
      )
    )
  }

  const removeDestination = (localId: string) => {
    replaceGroupItems(items.filter((item) => item.localId !== localId))
  }

  const distributeRemainingEqually = () => {
    if (items.length === 0 || remaining <= 0) return
    const parts = distributeAmounts(remaining, months)
    // Better: distribute remaining total across destinations equally
    const equalParts = (() => {
      const cents = Math.round(remaining * 100)
      const base = Math.floor(cents / items.length)
      const rem = cents - base * items.length
      return items.map((_, index) => (base + (index < rem ? 1 : 0)) / 100)
    })()

    replaceGroupItems(
      items.map((item, index) => {
        const nextTotal = roundMoney(lineTotal(item, months) + equalParts[index])
        return {
          ...item,
          amounts: distributeAmounts(nextTotal, months),
        }
      })
    )
    void parts
  }

  return (
    <section className="rounded-2xl border border-paper-muted bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-mist">
            Destinos de {label}
          </p>
          <h2 className="font-display text-xl font-semibold text-ink">
            Quanto vai para cada destino?
          </h2>
          <p className="mt-1 max-w-xl text-sm text-mist">
            Crie destinos simples, como times ou finalidades. Ex.: Insumos, Fretes,
            Manutenção, Mão de obra.
          </p>
        </div>
        <div className="rounded-xl bg-paper px-4 py-3 text-sm">
          <p className="text-mist">Grupo {label}</p>
          <p className="font-numeric font-semibold text-ink">
            {formatMoney(allocated)} / {formatMoney(planned)}
          </p>
          <p
            className={cn(
              'mt-1 text-xs',
              remaining === 0 ? 'text-ok' : remaining > 0 ? 'text-mist' : 'text-danger'
            )}
          >
            {remaining === 0
              ? 'Distribuição fechada'
              : remaining > 0
                ? `Restam ${formatMoney(remaining)}`
                : `Excedeu ${formatMoney(Math.abs(remaining))}`}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_160px_auto]">
        <Input
          label="Nome do destino"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ex.: Insumos"
        />
        <MoneyInput
          label="Valor no período"
          value={amount}
          onChange={setAmount}
          className="!rounded-xl !px-3.5 !py-2.5 !text-base"
        />
        <div className="flex items-end">
          <Button type="button" onClick={addDestination} className="w-full md:w-auto">
            Adicionar destino
          </Button>
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-danger">{error}</p>
      ) : null}

      {remaining > 0 && items.length > 0 ? (
        <div className="mt-3">
          <Button type="button" variant="secondary" onClick={distributeRemainingEqually}>
            Distribuir restante igualmente
          </Button>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3">
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-paper-muted px-4 py-8 text-center text-sm text-mist">
            Nenhum destino ainda. Adicione o primeiro para começar a distribuir os{' '}
            {formatMoney(planned)} de {label}.
          </p>
        ) : (
          items.map((item) => (
            <div
              key={item.localId}
              className="grid gap-3 rounded-xl border border-paper-muted bg-paper/30 p-3 md:grid-cols-[1fr_160px_auto]"
            >
              <Input
                label="Destino"
                value={item.destinationName}
                onChange={(event) =>
                  updateDestinationName(item.localId, event.target.value)
                }
              />
              <MoneyInput
                label="Valor"
                value={lineTotal(item, months)}
                onChange={(value) => updateDestinationAmount(item.localId, value)}
                className="!rounded-xl !px-3.5 !py-2.5 !text-base"
              />
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full text-danger md:w-auto"
                  onClick={() => removeDestination(item.localId)}
                >
                  Remover
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

interface DestinationReviewProps {
  draft: DraftBudget
  months: BudgetMonth[]
}

export function DestinationReview({ draft, months }: DestinationReviewProps) {
  const groups = useMemo(
    () =>
      MONEY_GROUPS.map((group) => {
        const planned =
          draft.groupTotals.find((entry) => entry.moneyGroup === group.id)?.total ?? 0
        const items = groupItems(draft.items, group.id)
        return { ...group, planned, items }
      }).filter((group) => group.planned > 0 || group.items.length > 0),
    [draft]
  )

  return (
    <section className="flex flex-col gap-4">
      {groups.map((group) => (
        <article
          key={group.id}
          className="rounded-2xl border border-paper-muted bg-white p-5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-lg font-semibold text-ink">
              {group.label}
            </h3>
            <p className="font-numeric text-sm font-semibold text-navy">
              {formatMoney(group.planned)}
            </p>
          </div>
          <ul className="mt-3 divide-y divide-paper-muted">
            {group.items.map((item) => (
              <li
                key={item.localId}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="text-ink">{item.destinationName}</span>
                <span className="font-numeric tabular-nums text-ink-soft">
                  {formatMoney(lineTotal(item, months))}
                </span>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  )
}
