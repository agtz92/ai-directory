import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'

export type StaffRole = '' | 'staff' | 'admin' | 'owner'

interface MeData {
  id: string
  email: string
  displayName: string
  tenantSlug: string
  tenantName: string
  tenantId: string
  staffRole: StaffRole
}

interface AuthState {
  session: Session | null
  token: string | null
  me: MeData | null
  setSession: (session: Session | null) => void
  setMe: (me: MeData | null) => void
  clearSession: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  session: null,
  token: null,
  me: null,
  setSession: (session) => set({ session, token: session?.access_token ?? null }),
  setMe: (me) => set({ me }),
  clearSession: () => set({ session: null, token: null, me: null }),
}))
