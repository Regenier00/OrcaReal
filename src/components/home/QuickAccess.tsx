import { Link } from 'react-router-dom'
import { appModules } from '@/content/appModules'
import { SectionHeading } from '@/components/home/FinancialSummary'
import {
  BudgetIcon,
  CompareIcon,
  ImportIcon,
  IndicatorsIcon,
} from '@/components/home/DashboardIcons'
import { cn } from '@/lib/utils'

const moduleIcons = {
  budget: BudgetIcon,
  actual: ImportIcon,
  'budget-vs-actual': CompareIcon,
  indicators: IndicatorsIcon,
}

export function QuickAccess() {
  return (
    <section>
      <SectionHeading
        kicker="Acesso rápido"
        title="Continue o trabalho pelo atalho certo"
        subtitle="Os módulos principais da operação financeira, com o mesmo destino de antes."
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {appModules.map((module) => {
          const Icon = moduleIcons[module.id]
          return (
            <Link
              key={module.id}
              to={module.to}
              className={cn(
                'group flex h-full flex-col rounded-2xl border border-paper-muted bg-white p-5 shadow-card transition',
                'hover:-translate-y-0.5 hover:border-navy/15 hover:shadow-soft'
              )}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-soft text-navy transition group-hover:bg-navy group-hover:text-white">
                <Icon />
              </span>
              <h3 className="mt-4 font-display text-base font-semibold text-navy">
                {module.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-mist">{module.summary}</p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
