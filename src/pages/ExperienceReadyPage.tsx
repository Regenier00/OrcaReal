import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useCompany } from '@/features/company/useCompany'
import { listCostCenters, listDepartments } from '@/features/company/companyService'
import {
  listCompanyAnalysisUnits,
  listCompanyOperations,
  listEnabledCompanyIndicators,
} from '@/features/experience/experienceService'
import { segmentLabel } from '@/features/company/segmentOptions'
import { Button } from '@/components/ui/Button'
import { FullPageStatus } from '@/components/ui/FullPageStatus'
import type { CostCenter, Department } from '@/types/database'

export function ExperienceReadyPage() {
  const { activeCompany, companyProfile, segments, refresh, loading } = useCompany()
  const [departments, setDepartments] = useState<Department[]>([])
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [units, setUnits] = useState<string[]>([])
  const [indicators, setIndicators] = useState<string[]>([])
  const [operations, setOperations] = useState<string[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!activeCompany) return
    let mounted = true
    void Promise.all([
      listDepartments(activeCompany.id),
      listCostCenters(activeCompany.id),
      listCompanyAnalysisUnits(activeCompany.id),
      listEnabledCompanyIndicators(activeCompany.id),
      listCompanyOperations(activeCompany.id),
    ]).then(([dept, centers, analysis, inds, ops]) => {
      if (!mounted) return
      setDepartments(dept.ok ? dept.data : [])
      setCostCenters(centers.ok ? centers.data : [])
      setUnits(
        analysis.ok
          ? analysis.data.map((row) => {
              const unit = row.analysis_unit as { name?: string } | { name?: string }[] | null
              const item = Array.isArray(unit) ? unit[0] : unit
              return item?.name ?? 'Unidade'
            })
          : []
      )
      setIndicators(
        inds.ok
          ? inds.data.map((row) => {
              const indicator = row.indicator as { name?: string } | { name?: string }[] | null
              const item = Array.isArray(indicator) ? indicator[0] : indicator
              return item?.name ?? 'Indicador'
            })
          : []
      )
      setOperations(
        ops.ok
          ? ops.data.map((row) => {
              const facts = row as { name: string }
              return facts.name
            })
          : []
      )
      setReady(true)
    })
    return () => {
      mounted = false
    }
  }, [activeCompany])

  const segment = useMemo(() => {
    return segments.find((item) => item.id === companyProfile?.segment_id)
  }, [segments, companyProfile])

  if (loading && !activeCompany) {
    return <FullPageStatus title="Carregando..." />
  }

  if (!activeCompany) {
    return <Navigate to="/app/criar-empresa" replace />
  }

  return (
    <div className="rounded-2xl border border-paper-muted bg-white px-6 py-10 sm:px-10">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-ok">
        Seu ambiente está pronto
      </p>
      <h1 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl">
        Estrutura personalizada da {activeCompany.trade_name || activeCompany.name}
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-mist sm:text-base">
        {companyProfile?.profile_summary ||
          `Montamos indicadores, unidades de análise e categorias a partir do ramo ${
            segment ? segmentLabel(segment.code) || segment.name : 'da empresa'
          }. Quanto mais você responder, mais precisa fica a OrcaReal.`}
      </p>

      {!ready ? (
        <p className="mt-8 text-sm text-mist">Organizando os detalhes do ambiente...</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <SummaryCard title="Operações" items={operations} />
          <SummaryCard title="Unidades de análise" items={units} />
          <SummaryCard
            title="Departamentos"
            items={departments.map((item) => item.name)}
          />
          <SummaryCard
            title="Centros de custo"
            items={costCenters.map((item) => item.name)}
          />
          <SummaryCard title="Indicadores ativos" items={indicators.slice(0, 12)} />
          <SummaryCard
            title="Estrutura de orçamento"
            items={['Orçado × Realizado', 'Categorias de custos', 'Resultado por unidade de análise']}
          />
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/app">
          <Button>Ver dashboard</Button>
        </Link>
        <Link to="/app/configurar-ambiente">
          <Button variant="secondary">Ajustar departamentos</Button>
        </Link>
      </div>
    </div>
  )
}

function SummaryCard({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-2xl border border-paper-muted bg-paper px-4 py-4">
      <h2 className="font-display text-lg font-semibold text-navy">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-mist">Ainda sem itens nesta camada.</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <li
              key={item}
              className="rounded-full bg-white px-3 py-1 text-xs font-medium text-ink-soft"
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
