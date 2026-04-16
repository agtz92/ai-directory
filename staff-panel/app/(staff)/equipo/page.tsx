'use client'

import { useState } from 'react'
import { useQuery, useMutation, useLazyQuery } from '@apollo/client'
import { STAFF_EMPLEADOS_QUERY, STAFF_BUSCAR_USUARIO_QUERY } from '@/lib/graphql/queries'
import { STAFF_ASIGNAR_ROL_MUTATION } from '@/lib/graphql/mutations'
import { useStaffRole } from '@/lib/use-staff-role'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { UserPlus, Loader2, Search, UserCheck, UserX, ChevronDown } from 'lucide-react'

const ROLE_OPTIONS = [
  { value: 'staff',  label: 'Empleado',  desc: 'Solo editar perfil de empresas' },
  { value: 'admin',  label: 'Admin',     desc: 'Editar + ver leads + cambiar plan' },
  { value: 'owner',  label: 'Owner',     desc: 'Acceso completo + gestionar equipo' },
  { value: '',       label: 'Sin acceso', desc: 'Quitar del equipo' },
]

const ROLE_BADGES: Record<string, string> = {
  staff: 'bg-gray-100 text-gray-700',
  admin: 'bg-blue-100 text-blue-700',
  owner: 'bg-purple-100 text-purple-700',
}

export default function EquipoPage() {
  const router = useRouter()
  const { canManageTeam } = useStaffRole()

  useEffect(() => {
    if (!canManageTeam) {
      toast.error('Solo el owner puede gestionar el equipo')
      router.push('/')
    }
  }, [canManageTeam, router])

  const { data, loading, refetch } = useQuery(STAFF_EMPLEADOS_QUERY, {
    skip: !canManageTeam,
  })

  const [asignarRol] = useMutation(STAFF_ASIGNAR_ROL_MUTATION)
  const [buscarUsuario, { loading: searching }] = useLazyQuery(STAFF_BUSCAR_USUARIO_QUERY)

  // Invite flow state
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  type FoundUser = { id: string; email: string; displayName: string; staffRole: string }
  const [found, setFound]   = useState<null | 'not-found' | FoundUser>(null)
  const [selectedRole, setSelectedRole] = useState('staff')
  const [assigning, setAssigning] = useState(false)

  const empleados = data?.staffEmpleados ?? []

  // ── Search ──────────────────────────────────────────────────────────────────
  const handleSearch = async () => {
    if (!inviteEmail.trim()) return
    const result = await buscarUsuario({ variables: { email: inviteEmail.trim() } })
    const user = result.data?.staffBuscarUsuario
    if (user) {
      setFound(user)
      setSelectedRole(user.staffRole || 'staff')
    } else {
      setFound('not-found')
    }
  }

  // ── Assign from invite panel ─────────────────────────────────────────────
  const handleAssignNew = async () => {
    if (!found || found === 'not-found') return
    setAssigning(true)
    try {
      await asignarRol({ variables: { userId: found.id, role: selectedRole } })
      toast.success(
        selectedRole
          ? `${found.email} ahora tiene rol ${selectedRole}`
          : `Acceso removido para ${found.email}`
      )
      setShowInvite(false)
      setInviteEmail('')
      setFound(null)
      refetch()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setAssigning(false)
    }
  }

  // ── Change role inline ────────────────────────────────────────────────────
  const handleCambiarRol = async (userId: string, role: string) => {
    try {
      await asignarRol({ variables: { userId, role } })
      toast.success(role ? `Rol actualizado a ${role}` : 'Acceso removido')
      refetch()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  if (!canManageTeam) return null

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipo interno</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestiona accesos al staff panel</p>
        </div>
        <button
          onClick={() => { setShowInvite(!showInvite); setFound(null); setInviteEmail('') }}
          className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <UserPlus size={15} />
          Agregar empleado
        </button>
      </div>

      {/* ── Invite panel ─────────────────────────────────────────────────── */}
      {showInvite && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
          <p className="text-sm font-semibold text-gray-800 mb-1">Agregar empleado</p>
          <p className="text-xs text-gray-500 mb-4">
            Busca la cuenta por email. El empleado debe haberse registrado primero en el sistema.
          </p>

          {/* Email search */}
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="empleado@directorio.com"
              value={inviteEmail}
              onChange={(e) => { setInviteEmail(e.target.value); setFound(null) }}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSearch}
              disabled={searching || !inviteEmail.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors"
            >
              {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Buscar
            </button>
          </div>

          {/* Result: not found */}
          {found === 'not-found' && (
            <div className="mt-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <UserX size={16} className="text-amber-500 mt-0.5 shrink-0" />
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-amber-800">Cuenta no registrada en el sistema</p>
                <p className="text-xs text-amber-700">
                  Puede tener cuenta de Supabase pero nunca ha iniciado sesión en la app.
                  Pídele que intente entrar a este panel con sus credenciales — aunque reciba
                  el error "sin acceso", su cuenta quedará registrada y podrás buscarlo aquí.
                </p>
                <p className="text-xs text-amber-600 font-medium">
                  Pasos: empleado intenta login aquí → recibe error → tú buscas su email → asignas rol → empleado entra normalmente.
                </p>
              </div>
            </div>
          )}

          {/* Result: found */}
          {found && found !== 'not-found' && (
            <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 bg-green-50 border-b border-gray-100 px-4 py-3">
                <UserCheck size={16} className="text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{found.displayName || found.email}</p>
                  <p className="text-xs text-gray-500">{found.email}</p>
                </div>
                {found.staffRole && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGES[found.staffRole] ?? 'bg-gray-100 text-gray-600'}`}>
                    {found.staffRole}
                  </span>
                )}
              </div>

              <div className="px-4 py-4 bg-white">
                <label className="block text-xs font-medium text-gray-600 mb-2">Asignar rol</label>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {ROLE_OPTIONS.filter(o => o.value !== '').map((o) => (
                    <button
                      key={o.value}
                      onClick={() => setSelectedRole(o.value)}
                      className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                        selectedRole === o.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <p className="font-medium">{o.label}</p>
                      <p className="text-xs opacity-70 mt-0.5">{o.desc}</p>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleAssignNew}
                    disabled={assigning}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {assigning && <Loader2 size={13} className="animate-spin" />}
                    Confirmar acceso
                  </button>
                  <button
                    onClick={() => { setShowInvite(false); setFound(null); setInviteEmail('') }}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Employees table ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-blue-600" size={24} />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Empleado</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Rol actual</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Cambiar rol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {empleados.map((emp: any) => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{emp.displayName || emp.email}</p>
                    <p className="text-xs text-gray-400">{emp.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGES[emp.staffRole] ?? 'bg-gray-100 text-gray-600'}`}>
                      {emp.staffRole || 'sin acceso'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={emp.staffRole}
                      onChange={(e) => handleCambiarRol(emp.id, e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                    >
                      {ROLE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {empleados.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center py-10 text-gray-400 text-sm">
                    No hay empleados en el equipo
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
