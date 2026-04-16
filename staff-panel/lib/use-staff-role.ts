/**
 * useStaffRole — returns role-based permission flags for the current staff user.
 *
 * Roles (ascending permissions):
 *   staff  → edit basic company profile only
 *   admin  → staff + manage leads + change plan + publish/archive
 *   owner  → admin + manage internal team
 */
import { useAuthStore, type StaffRole } from '@/lib/auth-store'

export function useStaffRole() {
  const role: StaffRole = useAuthStore((s) => s.me?.staffRole ?? '')

  return {
    role,
    isInternal:      role !== '',
    isAdmin:         role === 'admin' || role === 'owner',
    isOwner:         role === 'owner',
    canEditPerfil:   role !== '',
    canManageLeads:  role === 'admin' || role === 'owner',
    canChangePlan:   role === 'admin' || role === 'owner',
    canManageTeam:   role === 'owner',
  }
}
