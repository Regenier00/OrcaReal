import { useEffect, useState } from 'react'
import {
  getCompanySectorIntelligence,
  KNOWLEDGE_KIND_LABELS,
  refreshCompanySectorIntelligence,
} from '@/features/company/sectorIntelligenceService'
import { segmentLabel } from '@/features/company/segmentOptions'
import { Button } from '@/components/ui/Button'
import type { SectorIntelligence } from '@/types/database'

const KIND_ORDER = [
  'subramo',
  'activity',
  'product',
  'revenue',
  'cost',
  'expense',
  'indicator',
  'benchmark_metric',
] as const

export function SectorIntelligencePanel({
  companyId,
  canRefresh = false,
  compact = false,
}: {
  companyId: string
  canRefresh?: boolean
  compact?: boolean
}) {
  const [data, setData] = useState<SectorIntelligence | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    void getCompanySectorIntelligence(companyId).then((result) => {
      if (!mounted) return
      if (!result.ok) {
        setError(result.message)
        setData(null)
        return
      }
      setError('')
      setData(result.data)
    })
    return () => {
      mounted = false
    }
  }, [companyId])

  const handleRefresh = async () => {
    if (!canRefresh || refreshing) return
    setRefreshing(true)
    setError('')
    const result = await refreshCompanySectorIntelligence(companyId)
    setRefreshing(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setData(result.data)
  }

  if (!data && !error) {
    return <p className="text-sm text-mist">Montando inteligência setorial...</p>
  }

  if (error && !data) {
    return <p className="text-sm text-danger">{error}</p>
  }

  if (!data) return null

  const location = [data.location_city, data.location_state].filter(Boolean).join(' / ')
  const knowledgeKinds = KIND_ORDER.filter((kind) => (data.knowledge[kind] ?? []).length > 0)

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-navy">
            Inteligência setorial
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-mist">
            Perfil econômico montado a partir do cadastro. Fontes externas são
            selecionadas só para o ramo da empresa — sem inventar benchmarks.
          </p>
        </div>
        {canRefresh ? (
          <Button
            type="button"
            variant="secondary"
            disabled={refreshing}
            onClick={() => void handleRefresh()}
          >
            {refreshing ? 'Atualizando...' : 'Atualizar perfil'}
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <dl className="grid gap-3 sm:grid-cols-2">
        <Fact
          label="Ramo"
          value={segmentLabel(data.segment_code) || data.segment_code}
        />
        <Fact label="Subramo" value={data.subramo} />
        <Fact label="Atividade" value={data.activity} />
        <Fact label="Localização" value={location || null} />
        <Fact label="Porte" value={data.company_size} />
        <Fact
          label="Produtos / serviços"
          value={
            data.products_services.length > 0
              ? data.products_services.join(', ')
              : null
          }
        />
        <Fact label="Modelo de negócio" value={data.business_model_summary} />
        {data.extra_segments.length > 0 ? (
          <Fact
            label="Outras operações"
            value={data.extra_segments
              .map((code) => segmentLabel(code) || code)
              .join(', ')}
          />
        ) : null}
      </dl>

      <div>
        <h4 className="text-sm font-semibold text-ink">Fontes relevantes</h4>
        {data.selected_sources.length === 0 ? (
          <p className="mt-2 text-sm text-mist">
            Nenhuma fonte mapeada para este ramo ainda.
          </p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {data.selected_sources.map((source) => (
              <li
                key={`${source.code}-${source.segment_code}`}
                className="rounded-full bg-paper px-3 py-1 text-xs font-medium text-ink-soft"
                title={source.organization}
              >
                {source.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {!compact ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {knowledgeKinds.map((kind) => (
            <div
              key={kind}
              className="rounded-2xl border border-paper-muted bg-white px-4 py-4"
            >
              <h4 className="font-display text-base font-semibold text-navy">
                {KNOWLEDGE_KIND_LABELS[kind] ?? kind}
              </h4>
              <ul className="mt-3 space-y-1.5">
                {(data.knowledge[kind] ?? []).slice(0, 8).map((item) => (
                  <li key={`${kind}-${item.code}`} className="text-sm text-ink-soft">
                    {item.name}
                    {item.source_code ? (
                      <span className="text-mist"> · {item.source_code}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      <div className="rounded-2xl border border-dashed border-paper-muted bg-paper/40 px-4 py-4">
        <h4 className="text-sm font-semibold text-ink">Benchmarks externos</h4>
        {data.benchmarks.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {data.benchmarks.map((item) => (
              <li key={`${item.metric_code}-${item.source_code}`} className="text-sm text-ink-soft">
                <span className="font-medium text-ink">{item.metric_name}</span>
                {': '}
                {item.value_text ??
                  (item.value_numeric != null
                    ? `${item.value_numeric}${item.unit ? ` ${item.unit}` : ''}`
                    : '—')}
                <span className="text-mist">
                  {' '}
                  · {item.source_name}
                  {item.period_label ? ` · ${item.period_label}` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-mist">
            Ainda não há benchmarks ingeridos para este ramo. O sistema só
            exibe valores com fonte registrada — nenhum número é inventado.
          </p>
        )}
      </div>
    </section>
  )
}

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-xl bg-paper px-3 py-3">
      <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-mist">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-ink">{value?.trim() || '—'}</dd>
    </div>
  )
}
