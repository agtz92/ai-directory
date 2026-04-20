'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { CREAR_FORO_RESPUESTA_MUTATION } from '@/lib/graphql/queries'
import { Send } from 'lucide-react'

const GQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_URL!

async function fetchGql<T>(query: string, variables: Record<string, unknown>, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (json.errors?.length) throw new Error(json.errors[0].message)
  return json.data as T
}

export default function ReplyForm({ postId }: { postId: number }) {
  const router = useRouter()

  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [empresaNombre, setEmpresaNombre] = useState<string | null>(null)
  const [contenido, setContenido] = useState('')
  const [autorNombre, setAutorNombre] = useState('')
  const [autorEmail, setAutorEmail] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSessionToken(data.session.access_token)
        const meta = data.session.user.user_metadata
        if (meta?.empresa_nombre) setEmpresaNombre(meta.empresa_nombre)
      }
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!contenido.trim()) { toast.error('Escribe tu respuesta'); return }
    if (!empresaNombre && !autorNombre.trim()) { toast.error('Ingresa tu nombre'); return }

    setLoading(true)
    try {
      await fetchGql(
        CREAR_FORO_RESPUESTA_MUTATION,
        {
          postId,
          contenido: contenido.trim(),
          autorNombre: empresaNombre ?? autorNombre.trim(),
          autorEmail: autorEmail.trim() || null,
        },
        sessionToken ?? undefined,
      )
      toast.success('Respuesta publicada')
      setContenido('')
      setAutorNombre('')
      setAutorEmail('')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al publicar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
        Tu respuesta
      </h2>

      {sessionToken && empresaNombre && (
        <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-3">
          Respondiendo como <span className="font-medium">{empresaNombre}</span>
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <textarea
          value={contenido}
          onChange={(e) => setContenido(e.target.value)}
          rows={5}
          placeholder="Escribe tu respuesta..."
          required
          className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
        />

        {!empresaNombre && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Tu nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={autorNombre}
                onChange={(e) => setAutorNombre(e.target.value)}
                maxLength={150}
                placeholder="Nombre o empresa"
                required
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Email <span className="text-slate-400">(opcional)</span>
              </label>
              <input
                type="email"
                value={autorEmail}
                onChange={(e) => setAutorEmail(e.target.value)}
                placeholder="tucorreo@ejemplo.com"
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium text-sm px-5 py-2.5 rounded-lg transition-colors"
        >
          <Send size={14} />
          {loading ? 'Enviando...' : 'Enviar respuesta'}
        </button>
      </form>
    </section>
  )
}
