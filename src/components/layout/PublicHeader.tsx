import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface PublicHeaderProps {
  className?: string
  tone?: 'dark' | 'light'
}

export function PublicHeader({ className, tone = 'dark' }: PublicHeaderProps) {
  const dark = tone === 'dark'

  return (
    <header
      className={cn(
        'relative z-20 flex items-center justify-between gap-4 px-6 py-5 sm:px-10',
        className
      )}
    >
      <Link to="/" className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">
        <span className={dark ? 'text-white' : 'text-ink'}>Orca</span>
        <span className={dark ? 'text-sky' : 'text-navy-bright'}>Real</span>
      </Link>

      <nav className="flex items-center gap-4 sm:gap-6">
        <Link
          to="/demo"
          className={cn(
            'text-sm font-medium transition',
            dark
              ? 'text-white/70 hover:text-white'
              : 'text-ink-soft/70 hover:text-ink'
          )}
        >
          Experimentar
        </Link>
        <Link
          to="/login"
          className={cn(
            'text-sm font-medium transition',
            dark
              ? 'text-white/70 hover:text-white'
              : 'text-ink-soft/70 hover:text-ink'
          )}
        >
          Já tem conta? Entrar
        </Link>
      </nav>
    </header>
  )
}
