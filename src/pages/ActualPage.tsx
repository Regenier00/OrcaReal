import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCompany } from '@/features/company/useCompany'
import {
  deleteStatementImport,
  getActualSummary,
  listStatementImports,
} from '@/features/actual/actualService'
import type { ActualSummary } from '@/features/actual/actualService'
import { ACTUAL_PATHS } from '@/features/actual/model'
import { canDeleteImportedStatements } from '@/features/actual/permissions'
import type { StatementImport } from '@/types/database'
import { formatMoney } from '@/features/budget/money'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { ActualPageShell } from '@/components/actual/ActualPageShell'
import { ImportedStatementsList } from '@/components/actual/ImportedStatementsList'
import { ImportSummary } from '@/components/actual/ImportSummary'

export function ActualPage() {
  const { company, activeMembership, loading: companyLoading } = useCompany()
  const canDelete = canDeleteImportedStatements(activeMembership?.role)
  const [summary, setSummary] = useState<ActualSummary | null>(null)
  const [imports, setImports] = useState<StatementImport[]>([])
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<StatementImport | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!company) return
    const companyId = company.id
    let mounted = true
    void Promise.all([
      getActualSummary(companyId),
      listStatementImports(companyId),
    ])
      .then(([nextSummary, nextImports]) => {
        if (!mounted) return
        setSummary(nextSummary)
        setImports(nextImports)
        setError('')
        setFetchedFor(companyId)
      })
      .catch((err: unknown) => {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar o realizado.')
        setFetchedFor(companyId)
      })
    return () => {
      mounted = false
    }
  }, [company])

  const loading = company ? fetchedFor !== company.id : false
  const cards = useMemo(
    () => [
      { label: 'Entradas', value: formatMoney(summary?.incomeTotal ?? 0) },
      { label: 'Saídas', value: formatMoney(summary?.expenseTotal ?? 0) },
      {
        label: 'Não apropriados',
        value: String(summary?.pendingCount ?? 0),
        hint: 'Aguardando classificação',
      },
      {
        label: 'Apropriados',
        value: String(summary?.classifiedCount ?? 0),
        hint: 'Prontos para o Orçado × Realizado',
      },
    ],
    [summary],
  )

  const handleDelete = async () => {
    if (!company || !pendingDelete || !canDelete) return
    setDeleting(true)
    try {
      await deleteStatementImport(company.id, pendingDelete.id)
      const [nextSummary, nextImports] = await Promise.all([
        getActualSummary(company.id),
        listStatementImports(company.id),
      ])
      setSummary(nextSummary)
      setImports(nextImports)
      setPendingDelete(null)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir o extrato.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <ActualPageShell
      title="Realizado"
      description={`O extrato bancário da ${company?.trade_name || company?.name || 'empresa'} vira realizado aqui. O que ainda não tiver departamento e centro de custo fica em não apropriados até você classificar.`}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to={ACTUAL_PATHS.import}>
            <Button>Importar extrato</Button>
          </Link>
          <Link to={ACTUAL_PATHS.unappropriated}>
            <Button variant="secondary">Não apropriados</Button>
          </Link>
          <Link to={ACTUAL_PATHS.byBudget}>
            <Button variant="secondary">Por orçamento</Button>
          </Link>
        </div>
      }
    >
      {error ? (
        <p className="mt-4 rounded-xl border border-danger/20 bg-white px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {loading || companyLoading ? (
        <p className="mt-8 text-sm text-mist">Carregando realizado...</p>
      ) : (
        <>
          <div className="mt-8">
            <ImportSummary items={cards} />
          </div>

          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold text-navy">
              Extratos importados
            </h2>
            {imports.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-paper-muted bg-white px-6 py-12 text-center">
                <p className="font-display text-xl font-semibold text-ink">
                  Nenhum realizado ainda
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm text-mist">
                  Importe o extrato (OFX, CSV, XLSX ou PDF estruturado). O sistema
                  lê os lançamentos e envia os que faltam classificar para
                  Realizados não apropriados.
                </p>
                <Link to={ACTUAL_PATHS.import} className="mt-6 inline-block">
                  <Button>Importar extrato</Button>
                </Link>
              </div>
            ) : (
              <ImportedStatementsList
                imports={imports}
                onDelete={canDelete ? setPendingDelete : undefined}
              />
            )}
          </section>
        </>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Excluir extrato"
        body={`Excluir o extrato “${pendingDelete?.file_name ?? ''}”? Os lançamentos importados com ele serão removidos. Esta ação não pode ser desfeita.`}
        confirmLabel={deleting ? 'Excluindo...' : 'Excluir extrato'}
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!deleting) void handleDelete()
        }}
      />
    </ActualPageShell>
  )
}
