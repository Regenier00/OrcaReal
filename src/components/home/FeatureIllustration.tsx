import type { FeatureId } from '@/content/features'

interface FeatureIllustrationProps {
  id: FeatureId | 'actual'
}

function Bar({
  width,
  tone = 'muted',
}: {
  width: string
  tone?: 'muted' | 'strong'
}) {
  return (
    <div
      className={`h-2 rounded-sm ${tone === 'strong' ? 'bg-ink/70' : 'bg-paper-muted'}`}
      style={{ width }}
    />
  )
}

export function FeatureIllustration({ id }: FeatureIllustrationProps) {
  if (id === 'budget-vs-actual') {
    return (
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-mist">
            Orçado
          </p>
          <div className="flex flex-col gap-2.5">
            <Bar width="88%" />
            <Bar width="64%" />
            <Bar width="72%" />
            <Bar width="48%" />
          </div>
        </div>
        <div>
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-mist">
            Realizado
          </p>
          <div className="flex flex-col gap-2.5">
            <Bar width="92%" tone="strong" />
            <Bar width="54%" tone="strong" />
            <Bar width="80%" tone="strong" />
            <Bar width="41%" tone="strong" />
          </div>
        </div>
      </div>
    )
  }

  if (id === 'cost-analysis') {
    return (
      <div className="flex flex-col gap-3">
        {[
          { label: 'Pessoal', width: '92%' },
          { label: 'Operação', width: '68%' },
          { label: 'Administrativo', width: '44%' },
          { label: 'Outros', width: '22%' },
        ].map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex justify-between text-[11px] text-mist">
              <span>{row.label}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-sm bg-paper-muted">
              <div className="h-full rounded-sm bg-ink/65" style={{ width: row.width }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (id === 'actual') {
    return (
      <div className="overflow-hidden rounded-lg border border-paper-muted">
        {[
          { label: 'Janeiro', width: '72%' },
          { label: 'Fevereiro', width: '64%' },
          { label: 'Março', width: '81%' },
          { label: 'Abril', width: '58%' },
        ].map((row, index) => (
          <div
            key={row.label}
            className={`flex items-center justify-between px-3 py-2.5 text-xs ${
              index % 2 === 0 ? 'bg-paper' : 'bg-white'
            }`}
          >
            <span className="text-mist">{row.label}</span>
            <div className="h-1.5 w-20 overflow-hidden rounded-sm bg-paper-muted">
              <div className="h-full rounded-sm bg-ink/65" style={{ width: row.width }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (id === 'budget') {
    return (
      <div className="overflow-hidden rounded-lg border border-paper-muted">
        {['Departamento', 'Centro de custo', 'Categoria', 'Valor'].map(
          (label, index) => (
            <div
              key={label}
              className={`flex items-center justify-between px-3 py-2.5 text-xs ${
                index % 2 === 0 ? 'bg-paper' : 'bg-white'
              }`}
            >
              <span className="text-mist">{label}</span>
              <span className="h-1.5 w-16 rounded-sm bg-ink/20" />
            </div>
          )
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        { label: 'Desvio', value: '−8,4%' },
        { label: 'Desvio %', value: '12,1%' },
        { label: 'Concentração', value: '64%' },
        { label: 'Simulação', value: 'Ajustar' },
      ].map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-paper-muted bg-paper px-3 py-3"
        >
          <p className="text-[11px] uppercase tracking-wide text-mist">{item.label}</p>
            <p className="mt-1 font-numeric text-lg font-semibold text-ink">{item.value}</p>
        </div>
      ))}
    </div>
  )
}
