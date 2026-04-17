'use client'

/**
 * /setup — Post email-confirmation onboarding.
 *
 * Flow:
 *   1. User registers → Supabase sends confirmation email
 *   2. User clicks link → lands here (or on /login)
 *   3. User logs in → AuthProvider detects no tenant → redirect here
 *   4. User enters empresa name → backend creates Tenant + EmpresaPerfil
 *   5. Redirect to /dashboard
 */
import { useState } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { apolloClient } from '@/lib/apollo'
import { REGISTER_MUTATION } from '@/lib/graphql/mutations'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Building2 } from 'lucide-react'

export default function SetupPage() {
  const router = useRouter()
  const { token, session, setMe } = useAuthStore()
  const [nombreEmpresa, setNombreEmpresa] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !session) {
      toast.error('Sesión no encontrada. Por favor inicia sesión.')
      router.push('/login')
      return
    }
    setLoading(true)
    try {
      const result = await apolloClient.mutate({
        mutation: REGISTER_MUTATION,
        variables: {
          email: session.user.email ?? '',
          displayName: displayName || (session.user.email?.split('@')[0] ?? ''),
          nombreEmpresa,
        },
        context: { headers: { Authorization: `Bearer ${token}` } },
      })
      setMe(result.data?.register ?? null)
      toast.success('¡Empresa creada! Bienvenido al directorio.')
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.message || 'Error al crear la empresa')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Building2 size={20} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Configura tu empresa</h1>
            <p className="text-sm text-gray-500">Un último paso antes de entrar</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tu nombre</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Juan García"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de tu empresa *</label>
            <input
              type="text"
              required
              value={nombreEmpresa}
              onChange={(e) => setNombreEmpresa(e.target.value)}
              placeholder="Acero Industrial del Norte"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">Este será el nombre público en el directorio.</p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creando...' : 'Crear empresa y entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
