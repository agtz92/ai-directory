'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/auth-store'
import { apolloClient } from '@/lib/apollo'
import { STAFF_ME_QUERY } from '@/lib/graphql/queries'
import { toast } from 'sonner'
import { ShieldCheck, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { setSession, setMe, clearSession } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      setSession(data.session)

      // Verify the user has an internal staff role
      const result = await apolloClient.query({
        query: STAFF_ME_QUERY,
        fetchPolicy: 'network-only',
        context: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
      })

      const me = result.data?.me
      if (!me?.staffRole) {
        // No internal role — sign out and show error
        await supabase.auth.signOut()
        clearSession()
        toast.error('Tu cuenta no tiene acceso al panel de soporte. Contacta al owner.')
        return
      }

      setMe({
        id: me.id,
        email: me.email,
        displayName: me.displayName,
        tenantSlug: me.tenantSlug ?? '',
        tenantName: me.tenantName ?? '',
        tenantId: me.tenantId ?? '',
        staffRole: me.staffRole,
      })

      toast.success(`Bienvenido, ${me.displayName || me.email}`)
      router.push('/')
    } catch (err: any) {
      toast.error(err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-sm bg-gray-800 rounded-2xl border border-gray-700 p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <ShieldCheck size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Staff Panel</h1>
            <p className="text-xs text-gray-400">Directorio Industrial — Soporte interno</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Correo</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="empleado@directorio.com"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Verificando...' : 'Entrar al panel'}
          </button>
        </form>
      </div>
    </div>
  )
}
