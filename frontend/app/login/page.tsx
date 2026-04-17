'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/auth-store'
import { apolloClient } from '@/lib/apollo'
import { REGISTER_MUTATION } from '@/lib/graphql/mutations'
import { toast } from 'sonner'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { setSession, setMe } = useAuthStore()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [nombreEmpresa, setNombreEmpresa] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      setSession(data.session)
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      if (!data.session) {
        toast.success('Revisa tu correo para confirmar tu cuenta. Luego vuelve a iniciar sesión.')
        setMode('login')
        return
      }
      setSession(data.session)
      const result = await apolloClient.mutate({
        mutation: REGISTER_MUTATION,
        variables: {
          email,
          displayName: displayName || email.split('@')[0],
          nombreEmpresa: nombreEmpresa || displayName || email.split('@')[0],
        },
        context: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
      })
      setMe(result.data?.register ?? null)
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.message || 'Error al registrarse')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 bg-gradient-to-br from-slate-900 via-blue-950/60 to-slate-900 border-r border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-900/50">
            <span className="text-white text-xs font-black tracking-tight">DI</span>
          </div>
          <div>
            <span className="text-white font-bold text-lg">Directorio</span>
            <span className="text-blue-400 font-bold text-lg"> Industrial</span>
          </div>
        </div>
        <div>
          <p className="text-3xl font-bold text-white leading-snug mb-4">
            Tu empresa,<br />
            visible donde<br />
            importa.
          </p>
          <p className="text-slate-400 text-sm leading-relaxed">
            Conecta con compradores industriales, gestiona solicitudes de cotización y crece tu presencia en el directorio más completo de México.
          </p>
        </div>
        <p className="text-xs text-slate-600">© 2026 Directorio Industrial MX</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              <span className="text-white text-[10px] font-black">DI</span>
            </div>
            <span className="text-white font-bold">Directorio Industrial</span>
          </div>

          <h1 className="text-2xl font-bold text-white mb-1">
            {mode === 'login' ? 'Bienvenido de vuelta' : 'Crear cuenta'}
          </h1>
          <p className="text-sm text-slate-400 mb-8">
            {mode === 'login'
              ? 'Ingresa tus datos para continuar'
              : 'Registra tu empresa en minutos'}
          </p>

          <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Tu nombre</label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Juan García"
                    className="w-full bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Nombre de tu empresa</label>
                  <input
                    type="text"
                    required
                    value={nombreEmpresa}
                    onChange={(e) => setNombreEmpresa(e.target.value)}
                    placeholder="Acero Industrial del Norte"
                    className="w-full bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="tu@empresa.com"
                className="w-full bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 hover:shadow-blue-900/50 cursor-pointer mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Cargando...
                </span>
              ) : (
                <>
                  {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center space-y-3">
            <p className="text-sm text-slate-500">
              {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
              <button
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className="text-blue-400 font-medium hover:text-blue-300 transition-colors cursor-pointer"
              >
                {mode === 'login' ? 'Regístrate gratis' : 'Inicia sesión'}
              </button>
            </p>

            {mode === 'login' && (
              <a href="/forgot-password" className="block text-xs text-slate-600 hover:text-slate-400 transition-colors">
                ¿Olvidaste tu contraseña?
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
