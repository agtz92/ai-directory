'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useDebounce } from '@/lib/use-debounce'
import { CREAR_FORO_POST_MUTATION } from '@/lib/graphql/queries'
import { Send, ChevronLeft, X, ChevronDown } from 'lucide-react'
import Link from 'next/link'

const MAX_SUBCATEGORIAS = 5

type Subcategoria = {
  id: string
  nombre: string
  slug: string
  categoriaNombre: string
}

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

const SUBS_QUERY = `
  query SubcategoriasSearch($search: String, $limit: Int) {
    subcategorias(search: $search, limit: $limit) {
      id nombre slug categoriaNombre
    }
  }
`

export default function NuevaPage() {
  const router = useRouter()

  const [results, setResults] = useState<Subcategoria[]>([])       // dropdown results
  const [selected, setSelected] = useState<Subcategoria[]>([])     // chips
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [loading, setLoading] = useState(false)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [empresaNombre, setEmpresaNombre] = useState<string | null>(null)

  const [titulo, setTitulo] = useState('')
  const [contenido, setContenido] = useState('')
  const [autorNombre, setAutorNombre] = useState('')
  const [autorEmail, setAutorEmail] = useState('')

  const debouncedSearch = useDebounce(search, 300)

  // Prefetch 20 on mount
  useEffect(() => {
    fetchGql<{ subcategorias: Subcategoria[] }>(SUBS_QUERY, { limit: 20 })
      .then((d) => setResults(d.subcategorias))
      .catch(() => {/* silent */})
  }, [])

  // Search backend when user types >= 2 chars
  useEffect(() => {
    const trimmed = debouncedSearch.trim()
    if (trimmed.length < 2) {
      // Reset to prefetch when cleared
      if (trimmed.length === 0) {
        setSearching(true)
        fetchGql<{ subcategorias: Subcategoria[] }>(SUBS_QUERY, { limit: 20 })
          .then((d) => setResults(d.subcategorias))
          .finally(() => setSearching(false))
      }
      return
    }
    setSearching(true)
    fetchGql<{ subcategorias: Subcategoria[] }>(SUBS_QUERY, { search: trimmed, limit: 20 })
      .then((d) => setResults(d.subcategorias))
      .catch(() => {/* silent */})
      .finally(() => setSearching(false))
  }, [debouncedSearch])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSessionToken(data.session.access_token)
        const meta = data.session.user.user_metadata
        if (meta?.empresa_nombre) setEmpresaNombre(meta.empresa_nombre)
      }
    })
  }, [])

  const toggleSub = useCallback((sub: Subcategoria) => {
    setSelected((prev) => {
      if (prev.find((s) => s.slug === sub.slug)) return prev.filter((s) => s.slug !== sub.slug)
      if (prev.length >= MAX_SUBCATEGORIAS) {
        toast.error(`Máximo ${MAX_SUBCATEGORIAS} productos de interés`)
        return prev
      }
      return [...prev, sub]
    })
  }, [])

  // Filter out already-selected from dropdown
  const filtered = results.filter((s) => !selected.find((sel) => sel.slug === s.slug))

  // Group by category
  const grouped = filtered.reduce<Record<string, Subcategoria[]>>((acc, s) => {
    acc[s.categoriaNombre] = acc[s.categoriaNombre] ?? []
    acc[s.categoriaNombre].push(s)
    return acc
  }, {})

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selected.length === 0) { toast.error('Selecciona al menos un producto de interés'); return }
    if (!titulo.trim()) { toast.error('Escribe un título'); return }
    if (!contenido.trim()) { toast.error('Escribe el contenido'); return }
    if (!empresaNombre && !autorNombre.trim()) { toast.error('Ingresa tu nombre'); return }

    setLoading(true)
    try {
      const data = await fetchGql<{ crearForoPost: { id: string } }>(
        CREAR_FORO_POST_MUTATION,
        {
          subcategoriaSlugs: selected.map((s) => s.slug),
          titulo: titulo.trim(),
          contenido: contenido.trim(),
          autorNombre: empresaNombre ?? autorNombre.trim(),
          autorEmail: autorEmail.trim() || null,
        },
        sessionToken ?? undefined,
      )
      toast.success('¡Pregunta publicada!')
      router.push(`/foro/${data.crearForoPost.id}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al publicar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <Link
        href="/foro"
        className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-6 transition-colors"
      >
        <ChevronLeft size={15} />
        Volver al foro
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">
        Nueva pregunta
      </h1>

      {sessionToken && empresaNombre && (
        <div className="mb-5 flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-sm px-4 py-3 rounded-lg">
          <span className="font-medium">Publicando como:</span>
          <span>{empresaNombre}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Producto de interés — combobox con chips */}
        <div ref={dropdownRef}>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Producto de interés <span className="text-red-500">*</span>
            <span className="ml-2 text-xs font-normal text-slate-400">
              ({selected.length}/{MAX_SUBCATEGORIAS})
            </span>
          </label>

          {/* Input box con chips inline */}
          <div
            onClick={() => { if (selected.length < MAX_SUBCATEGORIAS) setDropdownOpen(true) }}
            className={`min-h-[42px] flex flex-wrap gap-1.5 items-center border rounded-lg px-2.5 py-2 bg-white dark:bg-slate-900 cursor-text transition-colors ${
              dropdownOpen
                ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                : 'border-slate-200 dark:border-slate-700'
            }`}
          >
            {selected.map((s) => (
              <span
                key={s.slug}
                className="inline-flex items-center gap-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs px-2 py-0.5 rounded-full shrink-0"
              >
                {s.nombre}
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleSub(s) }}
                  className="hover:text-indigo-900 dark:hover:text-white leading-none"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            {selected.length < MAX_SUBCATEGORIAS && (
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setDropdownOpen(true) }}
                onFocus={() => setDropdownOpen(true)}
                placeholder={selected.length === 0 ? 'Buscar producto...' : ''}
                className="flex-1 min-w-[120px] text-sm bg-transparent focus:outline-none text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
              />
            )}
            <ChevronDown
              size={14}
              className={`ml-auto text-slate-400 shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
            />
          </div>

          {/* Dropdown */}
          {dropdownOpen && (
            <div className="relative z-20">
              <div className="absolute top-1 left-0 right-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                {searching ? (
                  <p className="text-xs text-slate-400 text-center py-4">Buscando...</p>
                ) : Object.entries(grouped).length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">
                    {search.length > 0 && search.length < 2 ? 'Escribe al menos 2 caracteres' : 'Sin resultados'}
                  </p>
                ) : (
                  Object.entries(grouped).map(([cat, items]) => (
                    <div key={cat}>
                      <p className="px-3 pt-2.5 pb-0.5 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide sticky top-0 bg-white dark:bg-slate-900">
                        {cat}
                      </p>
                      {items.map((s) => (
                        <button
                          key={s.slug}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            toggleSub(s)
                            setSearch('')
                            setDropdownOpen(false)
                          }}
                          className="w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                        >
                          {s.nombre}
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Titulo */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Título <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={300}
            placeholder="¿Cuál es tu pregunta o tema?"
            required
            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Contenido */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Descripción <span className="text-red-500">*</span>
          </label>
          <textarea
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
            rows={6}
            placeholder="Explica tu pregunta con detalle..."
            required
            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
          />
        </div>

        {/* Author info — only shown when not authenticated as empresa */}
        {!empresaNombre && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
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
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email <span className="text-slate-400 dark:text-slate-500">(opcional)</span>
              </label>
              <input
                type="email"
                value={autorEmail}
                onChange={(e) => setAutorEmail(e.target.value)}
                placeholder="tucorreo@ejemplo.com"
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                No se muestra públicamente.
              </p>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium text-sm px-6 py-2.5 rounded-lg transition-colors"
        >
          <Send size={15} />
          {loading ? 'Publicando...' : 'Publicar pregunta'}
        </button>
      </form>
    </main>
  )
}
