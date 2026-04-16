'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/auth-store'
import { useStaffRole } from '@/lib/use-staff-role'
import { STAFF_EMPRESAS_QUERY, STAFF_NOTIFICACIONES_QUERY } from '@/lib/graphql/queries'
import { useQuery } from '@apollo/client'
import {
  LayoutDashboard, Users, LogOut, ShieldCheck, Search, Building2, Bell, BookOpen,
} from 'lucide-react'

const PLAN_COLORS: Record<string, string> = {
  free:       'bg-gray-700 text-gray-300',
  starter:    'bg-blue-900 text-blue-300',
  pro:        'bg-purple-900 text-purple-300',
  enterprise: 'bg-amber-900 text-amber-300',
}

const STATUS_DOTS: Record<string, string> = {
  published: 'bg-green-400',
  draft:     'bg-yellow-400',
  archived:  'bg-gray-400',
}

function useDebounce(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { me, clearSession } = useAuthStore()
  const { canManageTeam } = useStaffRole()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)

  const token = useAuthStore((s) => s.token)
  const { data } = useQuery(STAFF_EMPRESAS_QUERY, {
    variables: { search: debouncedSearch, limit: 30, offset: 0 },
    skip: !token,
  })

  const { data: notifData } = useQuery(STAFF_NOTIFICACIONES_QUERY, {
    variables: { soloNoLeidas: true },
    skip: !token,
    pollInterval: 30_000,
  })
  const unreadCount: number = notifData?.staffNotificaciones?.length ?? 0

  const empresas = data?.staffEmpresas?.empresas ?? []

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { clearSession(); router.push('/login') }
    })
    return () => subscription.unsubscribe()
  }, [clearSession, router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    clearSession()
    router.push('/login')
  }

  const roleLabel: Record<string, string> = {
    staff: 'Empleado', admin: 'Admin', owner: 'Owner',
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col bg-gray-900 border-r border-gray-800 shrink-0">
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-800 flex items-center gap-2">
          <ShieldCheck size={18} className="text-blue-400" />
          <div>
            <span className="text-sm font-bold text-white">Staff Panel</span>
            {me?.staffRole && (
              <span className="ml-2 text-xs bg-blue-900 text-blue-300 px-1.5 py-0.5 rounded">
                {roleLabel[me.staffRole] ?? me.staffRole}
              </span>
            )}
          </div>
        </div>

        {/* Main nav */}
        <nav className="px-2 py-3 border-b border-gray-800 space-y-1">
          <Link
            href="/"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname === '/'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <LayoutDashboard size={15} />
            Dashboard
          </Link>

          <Link
            href="/notificaciones"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname === '/notificaciones'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <div className="relative">
              <Bell size={15} />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            Notificaciones
            {unreadCount > 0 && (
              <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {unreadCount}
              </span>
            )}
          </Link>

          <Link
            href="/catalogo"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname === '/catalogo'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <BookOpen size={15} />
            Catálogo
          </Link>

          {canManageTeam && (
            <Link
              href="/equipo"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname === '/equipo'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Users size={15} />
              Equipo
            </Link>
          )}
        </nav>

        {/* Empresa search */}
        <div className="px-3 py-3 border-b border-gray-800">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Empresa list */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {empresas.map((e: any) => {
            const active = pathname.startsWith(`/empresa/${e.tenant?.id}`)
            return (
              <Link
                key={e.id}
                href={`/empresa/${e.tenant?.id}`}
                className={`flex items-start gap-2 px-2 py-2 rounded-lg transition-colors ${
                  active ? 'bg-gray-700' : 'hover:bg-gray-800'
                }`}
              >
                <Building2 size={14} className="text-gray-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white truncate">{e.nombreComercial}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[10px] px-1.5 rounded font-medium ${PLAN_COLORS[e.plan] ?? 'bg-gray-700 text-gray-300'}`}>
                      {e.plan}
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOTS[e.status] ?? 'bg-gray-500'}`} />
                    <span className="text-[10px] text-gray-400">{e.ciudad || '—'}</span>
                  </div>
                </div>
              </Link>
            )
          })}
          {empresas.length === 0 && (
            <p className="text-xs text-gray-500 px-2 py-4 text-center">
              {search ? 'Sin resultados' : 'Sin empresas'}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-gray-800">
          {me && <p className="text-xs text-gray-400 truncate px-1 mb-1">{me.email}</p>}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <LogOut size={13} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main — light background so forms/tables are readable */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        {children}
      </main>
    </div>
  )
}
