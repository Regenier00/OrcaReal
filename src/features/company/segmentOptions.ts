export type SegmentCode = 'agro' | 'commerce' | 'industry' | 'services' | 'other'

export const SEGMENT_OPTIONS: Array<{ code: SegmentCode; label: string }> = [
  { code: 'agro', label: 'Agronegócio' },
  { code: 'commerce', label: 'Comércio' },
  { code: 'industry', label: 'Indústria' },
  { code: 'services', label: 'Serviços' },
  { code: 'other', label: 'Outro' },
]

export function segmentLabel(code: string | null | undefined): string {
  return SEGMENT_OPTIONS.find((option) => option.code === code)?.label ?? code ?? ''
}

export function isSegmentCode(value: string): value is SegmentCode {
  return SEGMENT_OPTIONS.some((option) => option.code === value)
}
