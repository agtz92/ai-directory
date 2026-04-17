'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/auth-store'

/**
 * Rehydrates the in-memory auth store on page load/refresh by calling
 * supabase.auth.getSession(). The actual session cookie is httpOnly and
 * managed by @supabase/ssr — this just syncs it into Zustand memory so
 * components can access the JWT without extra async calls.
 *
 * Also subscribes to onAuthStateChange so token refreshes are picked up
 * automatically (Supabase rotates the access token every hour).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setSession, clearSession } = useAuthStore()

  useEffect(() => {
    // Rehydrate on mount (covers page refresh)
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    // Keep in sync with Supabase token refreshes and sign-outs
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession(session)
      } else {
        clearSession()
      }
    })

    return () => subscription.unsubscribe()
  }, [setSession, clearSession])

  return <>{children}</>
}
