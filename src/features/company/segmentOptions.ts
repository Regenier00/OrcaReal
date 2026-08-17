export const SEGMENT_OPTIONS = [
  { code: 'agro', label: 'Agricultura e Agronegócio' },
  { code: 'livestock', label: 'Pecuária' },
  { code: 'fishing', label: 'Pesca e Aquicultura' },
  { code: 'commerce', label: 'Comércio' },
  { code: 'industry', label: 'Indústria' },
  { code: 'construction', label: 'Construção Civil' },
  { code: 'services', label: 'Serviços' },
  { code: 'tech', label: 'Tecnologia e Informática' },
  { code: 'transport_logistics', label: 'Transporte e Logística' },
  { code: 'food', label: 'Alimentação' },
  { code: 'hospitality', label: 'Hotelaria e Turismo' },
  { code: 'health', label: 'Saúde' },
  { code: 'education', label: 'Educação' },
  { code: 'real_estate', label: 'Imobiliário' },
  { code: 'financial', label: 'Serviços Financeiros' },
  { code: 'automotive', label: 'Automotivo' },
  { code: 'energy', label: 'Energia' },
  { code: 'mining', label: 'Mineração' },
  { code: 'media', label: 'Comunicação e Mídia' },
  { code: 'marketing', label: 'Marketing e Publicidade' },
  { code: 'entertainment', label: 'Entretenimento e Cultura' },
  { code: 'sports', label: 'Esporte e Lazer' },
  { code: 'beauty', label: 'Beleza e Estética' },
  { code: 'professional', label: 'Serviços Profissionais' },
  { code: 'environment', label: 'Meio Ambiente' },
  { code: 'public_admin', label: 'Administração Pública' },
  { code: 'other', label: 'Outros' },
] as const

export type SegmentCode = (typeof SEGMENT_OPTIONS)[number]['code']

export function segmentLabel(code: string | null | undefined): string {
  return SEGMENT_OPTIONS.find((option) => option.code === code)?.label ?? code ?? ''
}

export function isSegmentCode(value: string): value is SegmentCode {
  return SEGMENT_OPTIONS.some((option) => option.code === value)
}

export function isOtherSegment(code: string | null | undefined): boolean {
  return code === 'other'
}
