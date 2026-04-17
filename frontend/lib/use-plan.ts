/**
 * usePlan — reads the current empresa plan and its authoritative limits
 * from the auth store (populated after login via ME_QUERY / register mutation).
 *
 * The limits come from the BACKEND (plan_limits.py) — never hardcoded here.
 * To change a limit, edit backend/directorio/plan_limits.py and restart Django.
 * See backend/edit_plans.md for instructions.
 *
 * Usage:
 *   const { plan, limits, isFree, atLeast, isUnlimited } = usePlan()
 */

import { useAuthStore, type EmpresaPlan, type PlanLimits } from '@/lib/auth-store'

/** Value the backend uses to signal "no limit". Never render this number in UI. */
export const UNLIMITED = 999

const FALLBACK_LIMITS: PlanLimits = {
  maxCategorias:              1,
  maxSubcategorias:           3,
  maxModelosPorSubcategoria:  2,
  puedeVerLeads:              false,
  puedeSubirPortada:          false,
  maxFotosGaleria:            0,
  badgeVerificado:            false,
  soporte:                    'comunidad',
}

const PLAN_RANK: Record<EmpresaPlan, number> = {
  free:       0,
  starter:    1,
  pro:        2,
  enterprise: 3,
}

export function usePlan() {
  const me = useAuthStore((s) => s.me)
  const plan: EmpresaPlan = me?.empresaPlan ?? 'free'
  const limits: PlanLimits = me?.planLimits ?? FALLBACK_LIMITS

  return {
    plan,
    limits,

    // Convenience booleans
    isFree:       plan === 'free',
    isStarter:    plan === 'starter',
    isPro:        plan === 'pro',
    isEnterprise: plan === 'enterprise',

    // atLeast('starter') → true if plan is starter, pro, or enterprise
    atLeast: (minimum: EmpresaPlan) => PLAN_RANK[plan] >= PLAN_RANK[minimum],

    // True when the backend returns 999 (unlimited)
    isUnlimited: (value: number) => value >= UNLIMITED,

    // Readable limit label: 999 → "Sin límite", otherwise the number
    limitLabel: (value: number) => (value >= UNLIMITED ? 'Sin límite' : String(value)),
  }
}
