import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'

/**
 * Auth state lives in memory only — no localStorage, no cookies from JS.
 * The actual session is managed by @supabase/ssr via httpOnly cookies,
 * which JavaScript cannot read (XSS-safe). This store just holds a
 * reference to the current session so components can access the JWT
 * for Authorization headers without re-fetching from Supabase on every call.
 *
 * On page refresh the store rehydrates from supabase.auth.getSession()
 * in the root layout (see app/layout.tsx AuthProvider).
 */

export type EmpresaPlan = 'free' | 'starter' | 'pro' | 'enterprise'
export type EmpresaStatus = 'draft' | 'published' | 'archived'

export interface PlanLimits {
  maxCategorias:               number   // 999 = unlimited
  maxSubcategorias:            number
  maxModelosPorSubcategoria:   number
  puedeVerLeads:               boolean
  puedeSubirPortada:           boolean
  maxFotosGaleria:             number
  badgeVerificado:             boolean
  soporte:                     string
}

interface MeData {
  id: string
  email: string
  displayName: string
  role: string
  tenantSlug: string
  tenantName: string
  tenantId: string
  tenantColor: string
  tenantModules: string[]
  empresaPlan: EmpresaPlan
  empresaStatus: EmpresaStatus
  planLimits: PlanLimits
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
  setSession: (session) =>
    set({
      session,
      token: session?.access_token ?? null,
    }),
  setMe: (me) => set({ me }),
  clearSession: () => set({ session: null, token: null, me: null }),
}))
