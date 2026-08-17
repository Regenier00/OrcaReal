import { evaluateCondition } from '@/features/experience/conditions'
import { DASHBOARD_SECTION_TITLES } from '@/features/experience/types'
import type {
  DashboardLayout,
  DashboardSectionId,
  EvaluationContext,
  ExperienceCatalog,
  IndicatorDef,
} from '@/features/experience/types'

export function selectIndicators(
  catalog: ExperienceCatalog,
  ctx: EvaluationContext
): IndicatorDef[] {
  return catalog.indicators
    .filter((indicator) => indicatorApplies(indicator, ctx))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
}

export function indicatorApplies(
  indicator: IndicatorDef,
  ctx: EvaluationContext
): boolean {
  if (indicator.segments && indicator.segments.length > 0) {
    const codes = [ctx.segmentCode, ...ctx.extraSegmentCodes]
    if (!indicator.segments.some((code) => codes.includes(code))) return false
  }

  if (indicator.unless && evaluateCondition(indicator.unless, ctx)) return false
  return evaluateCondition(indicator.activation, ctx)
}

const SECTION_ORDER: DashboardSectionId[] = [
  'financial',
  'operational',
  'budget_vs_actual',
  'profitability',
]

export function buildDashboardLayout(indicators: IndicatorDef[]): DashboardLayout {
  const sections = SECTION_ORDER.map((id) => ({
    id,
    title: DASHBOARD_SECTION_TITLES[id],
    indicatorCodes: indicators
      .filter((item) => item.dashboardSection === id)
      .map((item) => item.code),
  })).filter((section) => section.indicatorCodes.length > 0)

  return {
    sections,
    favorites: [],
    hidden: [],
    order: sections.flatMap((section) => section.indicatorCodes),
  }
}

export function visibleDashboardIndicators(
  indicators: IndicatorDef[],
  layout: DashboardLayout
): IndicatorDef[] {
  const hidden = new Set(layout.hidden)
  const order = new Map(layout.order.map((code, index) => [code, index]))
  const selected = new Set(layout.sections.flatMap((section) => section.indicatorCodes))

  return indicators
    .filter((item) => selected.has(item.code) && !hidden.has(item.code))
    .sort((a, b) => {
      const aFav = layout.favorites.includes(a.code) ? 0 : 1
      const bFav = layout.favorites.includes(b.code) ? 0 : 1
      if (aFav !== bFav) return aFav - bFav
      return (order.get(a.code) ?? 999) - (order.get(b.code) ?? 999)
    })
}
