'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/auth-store'
import { apolloClient } from '@/lib/apollo'
import { ME_QUERY } from '@/lib/graphql/queries'
import { ThemeToggle } from '@/components/ThemeToggle'
import {
  LayoutDashboard, Building2, Inbox, Settings, LogOut, Box, BookOpen,
} from 'lucide-react'

const NAV = [
  { href: '/dashboard',           label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/empresa',             label: 'Mi Empresa',     icon: Building2 },
  { href: '/empresa/leads',       label: 'Solicitudes',    icon: Inbox },
  { href: '/empresa/modelos',     label: 'Productos',      icon: Box },
  { href: '/recursos',            label: 'Recursos',       icon: BookOpen },
  { href: '/configuracion',       label: 'Configuración',  icon: Settings },
]

const PLAN_LABELS: Record<string, { label: string; cls: string }> = {
  free:       { label: 'Gratuito',    cls: 'bg-slate-700 text-slate-300' },
  starter:    { label: 'Starter',     cls: 'bg-blue-900/70 text-blue-300' },
  pro:        { label: 'Pro',         cls: 'bg-violet-900/70 text-violet-300' },
  enterprise: { label: 'Enterprise',  cls: 'bg-amber-900/70 text-amber-300' },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { clearSession, token, me, setMe } = useAuthStore()

  useEffect(() => {
    if (!token) return
    if (me?.tenantId) return
    apolloClient.query({ query: ME_QUERY, fetchPolicy: 'network-only' })
      .then((result) => { if (result.data?.me) setMe(result.data.me) })
      .catch(() => { router.push('/setup') })
  }, [token, me, setMe, router])

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

  const initials = me?.email ? me.email.slice(0, 2).toUpperCase() : '??'
  const plan = me?.empresaPlan ? PLAN_LABELS[me.empresaPlan] : null

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">

      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside className="w-64 flex flex-col bg-slate-900 shrink-0 shadow-xl shadow-black/20">

        {/* Logo + theme toggle */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-sm shadow-blue-900/50">
              <span className="text-white text-[10px] font-black tracking-tight">DI</span>
            </div>
            <div className="leading-tight">
              <span className="text-white font-bold text-sm">Directorio</span>
              <span className="text-blue-400 font-bold text-sm"> Industrial</span>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {/* Tenant info */}
        {me && (
          <div className="px-4 py-3 border-b border-slate-800/80">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Empresa activa</p>
            <p className="text-sm font-semibold text-slate-200 truncate">{me.tenantName}</p>
            {plan && (
              <span className={`inline-flex items-center mt-1.5 text-[11px] px-2 py-0.5 rounded-full font-medium ${plan.cls}`}>
                {plan.label}
              </span>
            )}
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && href !== '/empresa' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
                }`}
              >
                <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* User + logout */}
        <div className="px-2.5 py-3 border-t border-slate-800/80">
          <div className="flex items-center gap-2.5 px-3 py-2 mb-1 rounded-xl">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shrink-0 ring-1 ring-slate-600">
              <span className="text-[11px] text-slate-200 font-semibold">{initials}</span>
            </div>
            {me && <p className="text-xs text-slate-400 truncate">{me.email}</p>}
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-slate-400 hover:text-red-400 hover:bg-red-950/40 rounded-xl transition-all duration-150 cursor-pointer"
          >
            <LogOut size={16} strokeWidth={1.8} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
        {children}
      </main>
    </div>
  )
}
