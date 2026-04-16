'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/auth-store'
import { apolloClient } from '@/lib/apollo'
import { STAFF_ME_QUERY } from '@/lib/graphql/queries'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setSession, setMe, clearSession } = useAuthStore()

  useEffect(() => {
    // On initial load: restore session from Supabase storage and re-fetch me
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return
      setSession(data.session)
      try {
        const result = await apolloClient.query({
          query: STAFF_ME_QUERY,
          fetchPolicy: 'network-only',
          context: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
        })
        const me = result.data?.me
        if (me?.staffRole) {
          setMe({
            id: me.id,
            email: me.email,
            displayName: me.displayName,
            tenantSlug: me.tenantSlug ?? '',
            tenantName: me.tenantName ?? '',
            tenantId: me.tenantId ?? '',
            staffRole: me.staffRole,
          })
        } else {
          // Has a session but no staff role — sign out
          await supabase.auth.signOut()
          clearSession()
        }
      } catch {
        // Network error or schema issue — don't log out, just skip me restore
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setSession(session)
      else clearSession()
    })

    return () => subscription.unsubscribe()
  }, [setSession, setMe, clearSession])

  return <>{children}</>
}
