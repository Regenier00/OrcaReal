import { type ReactNode } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'
import { Button } from '@/components/ui/Button'

export function OnboardingShell({ children }: { children?: ReactNode }) {
  const { signOut, user } = useAuth()

  return (
    <div className="min-h-svh bg-paper">
      <header className="border-b border-paper-muted bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-2.5">
          <Link to="/app" className="font-display text-lg font-bold tracking-tight">
            <span className="text-ink">Orca</span>
            <span className="text-brand">Real</span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden max-w-48 truncate text-xs text-mist sm:inline">
              {user?.email}
            </span>
            <Button variant="quiet" className="!py-2 !text-xs" onClick={() => void signOut()}>
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8 sm:py-12">
        {children ?? <Outlet />}
      </main>
    </div>
  )
}
