'use client'

/**
 * /reclamar/[token] — Claim an existing EmpresaPerfil via invite link.
 *
 * Scenario 2: An empresa was pre-loaded or created by admin.
 * A special link is generated via:
 *   python manage.py generar_invitacion --empresa-slug=xxx --email=owner@company.com
 *
 * Flow:
 *   1. Page loads → fetch public invitacion info (empresa name, valid?)
 *   2. User fills form (create account or log in)
 *   3. supabase.signUp / signIn → get JWT
 *   4. Call reclamarEmpresa(token) mutation → links user to tenant as OWNER
 *   5. Redirect to /dashboard
 */
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/auth-store'
import { apolloClient } from '@/lib/apollo'
import { RECLAMAR_EMPRESA_MUTATION } from '@/lib/graphql/mutations'
import { toast } from 'sonner'
import { Building2, CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface InvitacionInfo {
  empresaNombre: string
  empresaSlug: string
  valid: boolean
  emailRestringido: boolean
}

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

async function fetchInvitacionInfo(token: string): Promise<InvitacionInfo | null> {
  const res = await fetch(`${API}/public/graphql/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        query($token: String!) {
          invitacion(token: $token) {
            empresaNombre empresaSlug valid emailRestringido
          }
        }
      `,
      variables: { token },
    }),
  })
  const data = await res.json()
  return data?.data?.invitacion ?? null
}

export default function ReclamarPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string
  const { setSession, setMe } = useAuthStore()

  const [info, setInfo] = useState<InvitacionInfo | null>(null)
  const [loadingInfo, setLoadingInfo] = useState(true)
  const [mode, setMode] = useState<'register' | 'login'>('register')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchInvitacionInfo(token)
      .then(setInfo)
      .finally(() => setLoadingInfo(false))
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      let session: any = null

      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (!data.session) {
          toast.error('Confirma tu correo primero y luego vuelve a este link.')
          setMode('login')
          setLoading(false)
          return
        }
        session = data.session
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        session = data.session
      }

      setSession(session)

      // Claim the empresa
      const result = await apolloClient.mutate({
        mutation: RECLAMAR_EMPRESA_MUTATION,
        variables: { token },
        context: { headers: { Authorization: `Bearer ${session.access_token}` } },
      })
      setMe(result.data?.reclamarEmpresa ?? null)
      toast.success(`¡Empresa reclamada! Bienvenido a ${info?.empresaNombre}.`)
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.message || 'Error al reclamar la empresa')
    } finally {
      setLoading(false)
    }
  }

  if (loadingInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    )
  }

  if (!info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-sm">
          <XCircle className="mx-auto text-red-400 mb-4" size={48} />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link no encontrado</h1>
          <p className="text-sm text-gray-500">Este link de invitación no existe o fue generado incorrectamente.</p>
        </div>
      </div>
    )
  }

  if (!info.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-sm">
          <XCircle className="mx-auto text-red-400 mb-4" size={48} />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link expirado o ya usado</h1>
          <p className="text-sm text-gray-500">
            Esta invitación ya fue utilizada o expiró. Solicita un nuevo link al administrador.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8">

        {/* Company header */}
        <div className="flex items-center gap-3 mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
            <Building2 size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-blue-500 font-medium uppercase tracking-wide">Estás reclamando</p>
            <p className="font-bold text-gray-900">{info.empresaNombre}</p>
          </div>
        </div>

        {info.emailRestringido && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
            ⚠ Esta invitación está restringida a un correo específico. Usa el correo al que fue enviada.
          </div>
        )}

        <h1 className="text-lg font-bold text-gray-900 mb-1">
          {mode === 'register' ? 'Crear cuenta para reclamar' : 'Inicia sesión para reclamar'}
        </h1>
        <p className="text-sm text-gray-500 mb-5">
          {mode === 'register'
            ? 'Crea una cuenta nueva y serás el propietario de esta empresa en el directorio.'
            : 'Usa tu cuenta existente para asumir la propiedad de esta empresa.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
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
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@empresa.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Procesando...' : mode === 'register' ? 'Crear cuenta y reclamar empresa' : 'Iniciar sesión y reclamar empresa'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          {mode === 'register' ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
          <button
            onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
            className="text-blue-600 font-medium hover:underline"
          >
            {mode === 'register' ? 'Inicia sesión' : 'Créala aquí'}
          </button>
        </p>
      </div>
    </div>
  )
}
