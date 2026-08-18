import type { SVGProps } from 'react'
import { cn } from '@/lib/utils'

type IconProps = SVGProps<SVGSVGElement> & { className?: string }

function Svg({ className, children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn('h-5 w-5', className)}
      {...props}
    >
      {children}
    </svg>
  )
}

export function WalletIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H19a2 2 0 0 1 2 2v9.5A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5Z" />
      <path d="M3 9h16a2 2 0 0 1 2 2v1.2a1.8 1.8 0 0 1-1.8 1.8H16a2 2 0 1 1 0-4h4" />
    </Svg>
  )
}

export function TrendUpIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 16.5 10.2 10l3.3 3.3L20 7" />
      <path d="M14 7h6v6" />
    </Svg>
  )
}

export function TrendDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7.5 10.2 14l3.3-3.3L20 17" />
      <path d="M14 17h6v-6" />
    </Svg>
  )
}

export function ReceiptIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 4.5h12v15l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2-2 1.2Z" />
      <path d="M9 9h6M9 12.5h6" />
    </Svg>
  )
}

export function ScaleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4v16M8 20h8" />
      <path d="M12 7h8l-2.5 5.5a3.5 3.5 0 1 1-7 0Z" />
      <path d="M12 7H4l2.5 5.5a3.5 3.5 0 1 0 7 0Z" />
    </Svg>
  )
}

export function CalculatorIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M8 8h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" />
    </Svg>
  )
}

export function BudgetIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 6.5A1.5 1.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5V19l-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z" />
      <path d="M9 10h6M9 13.5h4" />
    </Svg>
  )
}

export function ImportIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4v10" />
      <path d="m8.5 10.5 3.5 3.5 3.5-3.5" />
      <path d="M5 18h14" />
    </Svg>
  )
}

export function CompareIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 19V9" />
      <path d="M12 19V5" />
      <path d="M18 19v-7" />
    </Svg>
  )
}

export function IndicatorsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 1.5" />
    </Svg>
  )
}

export function SparkIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5 9.8 9H4.5L8.8 13l-1.6 6.5L12 16.2l4.8 3.3L15.2 13l4.3-4H14.2Z" />
    </Svg>
  )
}

export function AlertIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m12 4 8.5 15h-17Z" />
      <path d="M12 10v4M12 16.5h.01" />
    </Svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="m8.8 12.2 2.2 2.2 4.2-4.4" />
    </Svg>
  )
}

export function InfoIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 11v5M12 8h.01" />
    </Svg>
  )
}

export function BuildingIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20h16M6 20V6.5A1.5 1.5 0 0 1 7.5 5h9A1.5 1.5 0 0 1 18 6.5V20" />
      <path d="M9 9h.01M12 9h.01M15 9h.01M9 13h.01M12 13h.01M15 13h.01" />
    </Svg>
  )
}

export function CalendarIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3.5V7M16 3.5V7M4 10h16" />
    </Svg>
  )
}
