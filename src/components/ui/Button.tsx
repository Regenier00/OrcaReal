import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'quiet' | 'inverse' | 'danger'
type Size = 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
}

const variants: Record<Variant, string> = {
  primary:
    'bg-brand text-white hover:bg-brand-hover shadow-[0_10px_24px_-14px_rgb(170_0_255_/_0.55)]',
  secondary:
    'bg-white text-ink hover:bg-paper border border-paper-muted',
  ghost:
    'bg-transparent text-paper/80 hover:text-paper hover:bg-white/5',
  quiet:
    'bg-transparent text-ink-soft/80 hover:text-ink hover:bg-paper',
  inverse:
    'bg-paper text-ink hover:bg-white',
  danger:
    'bg-danger text-white hover:bg-danger/90 shadow-[0_10px_24px_-14px_rgb(163_59_59_/_0.55)]',
}

const sizes: Record<Size, string> = {
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3.5 text-base',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold transition duration-200',
        'disabled:cursor-not-allowed disabled:opacity-55',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
