import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import {
  getCompanyExperienceAnswers,
  saveCompanyOperationalPriorities,
} from '@/features/experience/experienceService'
import {
  OPERATION_PRIORITIES_QUESTION,
  operationModelFromValue,
  operationModelLabel,
  selectedOperationPriorities,
} from '@/features/experience/catalog/operationModels'

export function OperationalPrioritiesEditor({
  companyId,
  canEdit,
  operationModel,
}: {
  companyId: string
  canEdit: boolean
  operationModel: string
}) {
  const model = useMemo(() => operationModelFromValue(operationModel), [operationModel])
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let mounted = true
    void getCompanyExperienceAnswers(companyId).then((result) => {
      if (!mounted) return
      if (result.ok) {
        setSelected(selectedOperationPriorities(result.data[OPERATION_PRIORITIES_QUESTION]))
      }
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [companyId])

  const toggle = (code: string) => {
    setSelected((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code]
    )
    setMessage('')
    setError('')
  }

  const handleSave = async () => {
    if (!canEdit || saving) return
    setSaving(true)
    setError('')
    setMessage('')
    const allowed = new Set(model?.indicators.map((item) => item.code) ?? [])
    const result = await saveCompanyOperationalPriorities({
      companyId,
      codes: selected.filter((code) => allowed.has(code)),
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setMessage('Indicadores operacionais atualizados.')
  }

  if (!model) {
    return (
      <div className="rounded-2xl border border-paper-muted bg-white px-4 py-4">
        <h3 className="font-display text-lg font-semibold text-navy">
          Indicadores operacionais
        </h3>
        <p className="mt-2 text-sm text-mist">
          Informe o modelo de operação no questionário para escolher os indicadores.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-2xl border border-paper-muted bg-white px-4 py-4">
      <div>
        <h3 className="font-display text-lg font-semibold text-navy">
          Indicadores operacionais
        </h3>
        <p className="mt-1 text-sm text-mist">
          Marque ou desmarque as informações de {operationModelLabel(operationModel)}. Elas
          aparecem na tela de indicadores operacionais.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-mist">Carregando indicadores...</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {model.indicators.map((item) => {
            const active = selected.includes(item.code)
            return (
              <button
                key={item.code}
                type="button"
                disabled={!canEdit}
                onClick={() => toggle(item.code)}
                className={cn(
                  'rounded-xl border px-3 py-3 text-left text-sm leading-snug transition',
                  active
                    ? 'border-brand bg-brand text-white'
                    : 'border-paper-muted bg-white text-ink-soft hover:border-brand',
                  !canEdit && 'cursor-default opacity-80'
                )}
              >
                {item.name}
              </button>
            )
          })}
        </div>
      )}

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {message ? <p className="text-sm text-ok">{message}</p> : null}
      {canEdit ? (
        <Button type="button" disabled={saving || loading} onClick={() => void handleSave()}>
          {saving ? 'Salvando...' : 'Salvar indicadores'}
        </Button>
      ) : (
        <p className="text-sm text-mist">
          Somente administradores podem alterar os indicadores operacionais.
        </p>
      )}
    </div>
  )
}
