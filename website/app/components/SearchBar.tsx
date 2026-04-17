'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, ArrowRight, Tag, Building2 } from 'lucide-react'
import { SUBCATEGORIAS_SEARCH_QUERY, DIRECTORIO_SEARCH_QUERY } from '@/lib/graphql/queries'

interface Subcategoria {
  id: string
  nombre: string
  slug: string
  categoriaId: string
  categoriaNombre: string
}

interface Empresa {
  id: string
  nombreComercial: string
  slug: string
  ciudad?: string
  estado?: string
}

type Result = Subcategoria | Empresa

interface Props {
  defaultValue?: string
  placeholder?: string
  size?: 'md' | 'lg'
  mode?: 'subcategorias' | 'proveedores'
  submitTo?: string
}

const API_URL = `${process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'}/graphql/`

export default function SearchBar({
  defaultValue = '',
  placeholder = 'Busca subcategorías, productos o servicios...',
  size = 'md',
  mode = 'subcategorias',
  submitTo,
}: Props) {
  const router = useRouter()
  const defaultSubmitTo = submitTo ?? (mode === 'proveedores' ? '/proveedores' : '/buscar')

  const [query, setQuery] = useState(defaultValue)
  const [results, setResults] = useState<Result[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const containerRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController>()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setOpen(false); return }

    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setLoading(true)

    try {
      if (mode === 'proveedores') {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: DIRECTORIO_SEARCH_QUERY, variables: { search: q, limit: 6 } }),
          signal: abortRef.current.signal,
        })
        const data = await res.json()
        const empresas: Empresa[] = data.data?.directorio?.empresas ?? []
        setResults(empresas)
        setOpen(empresas.length > 0)
      } else {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: SUBCATEGORIAS_SEARCH_QUERY, variables: { search: q, limit: 8 } }),
          signal: abortRef.current.signal,
        })
        const data = await res.json()
        const subs: Subcategoria[] = data.data?.subcategorias ?? []
        setResults(subs)
        setOpen(subs.length > 0)
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') { setResults([]); setOpen(false) }
    } finally {
      setLoading(false)
    }
  }, [mode])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (query.length < 2) { setResults([]); setOpen(false); setLoading(false); return }
    setLoading(true)
    debounceRef.current = setTimeout(() => fetchSuggestions(query), 280)
    return () => clearTimeout(debounceRef.current)
  }, [query, fetchSuggestions])

  function handleSelect(item: Result) {
    if (mode === 'proveedores') {
      router.push(`/empresas/${(item as Empresa).slug}`)
    } else {
      router.push(`/buscar?q=${encodeURIComponent((item as Subcategoria).nombre)}`)
    }
    setOpen(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) {
      router.push(`${defaultSubmitTo}?q=${encodeURIComponent(query.trim())}`)
      setOpen(false)
    }
  }

  const inputCls = size === 'lg'
    ? 'w-full pl-12 pr-10 py-4 rounded-2xl text-base'
    : 'w-full pl-11 pr-10 py-3 rounded-xl text-sm'

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          {loading
            ? <span className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            : <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={size === 'lg' ? 20 : 17} />
          }
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder={placeholder}
            autoComplete="off"
            className={`${inputCls} border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-shadow`}
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </form>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-[100] overflow-hidden">
          <div className="py-1">
            {mode === 'proveedores'
              ? (results as Empresa[]).map(emp => (
                  <button
                    key={emp.id}
                    onClick={() => handleSelect(emp)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors text-left group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                      <Building2 size={12} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate block">
                        {emp.nombreComercial}
                      </span>
                      {(emp.ciudad || emp.estado) && (
                        <span className="text-xs text-slate-400 truncate block">
                          {[emp.ciudad, emp.estado].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </div>
                    <ArrowRight size={13} className="text-slate-300 group-hover:text-blue-500 shrink-0 transition-colors" />
                  </button>
                ))
              : (results as Subcategoria[]).map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => handleSelect(sub)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors text-left group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                      <Tag size={12} className="text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate block">
                        {sub.nombre}
                      </span>
                      <span className="text-xs text-slate-400 truncate block">{sub.categoriaNombre}</span>
                    </div>
                    <ArrowRight size={13} className="text-slate-300 group-hover:text-blue-500 shrink-0 transition-colors" />
                  </button>
                ))
            }
          </div>
          <button
            onClick={handleSubmit as any}
            className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-900/60 hover:bg-blue-50 dark:hover:bg-blue-950/40 border-t border-slate-100 dark:border-slate-700 transition-colors group"
          >
            <Search size={13} className="text-blue-600 shrink-0" />
            <span className="text-sm text-blue-600 font-medium group-hover:underline">
              {mode === 'proveedores'
                ? <>Buscar proveedores de &ldquo;{query}&rdquo;</>
                : <>Buscar proveedores de &ldquo;{query}&rdquo;</>
              }
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
