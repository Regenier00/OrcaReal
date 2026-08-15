import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { ensureUserProfile } from '@/features/auth/profileService'
import { AuthContext } from '@/features/auth/auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const sync = async (nextSession: Session | null) => {
      try {
        if (nextSession?.user) {
          await ensureUserProfile(
            nextSession.user.id,
            nextSession.user.user_metadata?.name || '',
            nextSession.user.email
          )
        }

        if (!mounted) return
        setSession(nextSession)
        setUser(nextSession?.user ?? null)
      } catch (error) {
        console.error('Erro ao sincronizar sessão:', error)
        if (!mounted) return
        setSession(nextSession)
        setUser(nextSession?.user ?? null)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void supabase.auth.getSession().then(({ data }) => {
      void sync(data.session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void sync(nextSession)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const value = useMemo(
    () => ({ user, session, loading, signOut }),
    [user, session, loading, signOut]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
