import { gql } from '@/lib/graphql'
import Link from 'next/link'
import type { Metadata } from 'next'
import { MapPin, BadgeCheck, ChevronLeft, ChevronRight, Building2 } from 'lucide-react'
import SearchBar from '../components/SearchBar'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Proveedores | Directorio Industrial MX',
  description: 'Directorio completo de proveedores industriales en México.',
}

const PER_PAGE = 20

interface Props {
  searchParams: Promise<{ q?: string; page?: string; ciudad?: string; estado?: string }>
}

interface EmpresaCard {
  id: string
  nombreComercial: string
  slug: string
  ciudad?: string
  estado?: string
  plan: string
  scoreCompletitud?: number
  verified: boolean
  logoUrl?: string
  descripcion?: string
  categorias: { nombre: string; slug: string }[]
}

interface DirectorioResult {
  total: number
  hasMore: boolean
  empresas: EmpresaCard[]
}

export default async function ProveedoresPage({ searchParams }: Props) {
  const { q = '', page: pageParam = '1', ciudad = '', estado = '' } = await searchParams
  const page = Math.max(1, parseInt(pageParam) || 1)
  const offset = (page - 1) * PER_PAGE

  let result: DirectorioResult = { total: 0, hasMore: false, empresas: [] }
  let error = false
  try {
    const data = await gql<{ directorio: DirectorioResult }>(`
      query($search: String!, $ciudad: String!, $estado: String!, $limit: Int!, $offset: Int!) {
        directorio(search: $search, ciudad: $ciudad, estado: $estado, limit: $limit, offset: $offset) {
          total hasMore
          empresas {
            id nombreComercial slug ciudad estado plan scoreCompletitud verified logoUrl
            categorias { nombre slug }
          }
        }
      }
    `, { search: q, ciudad, estado, limit: PER_PAGE, offset }, 0)
    result = data.directorio
  } catch {
    error = true
  }

  const totalPages = Math.max(1, Math.ceil(result.total / PER_PAGE))

  function buildUrl(p: number) {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (ciudad) params.set('ciudad', ciudad)
    if (estado) params.set('estado', estado)
    if (p > 1) params.set('page', String(p))
    const s = params.toString()
    return `/proveedores${s ? `?${s}` : ''}`
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Page header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-5">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                Proveedores industriales
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {result.total > 0
                  ? <><span className="font-semibold text-slate-700 dark:text-slate-300">{result.total.toLocaleString()}</span> proveedores registrados</>
                  : 'Directorio de proveedores en México'
                }
              </p>
            </div>
          </div>
          <SearchBar defaultValue={q} placeholder="Busca por nombre o categoría..." mode="proveedores" />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {error ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Building2 size={24} className="text-slate-400" />
            </div>
            <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">No se pudo cargar el directorio</p>
            <p className="text-sm text-slate-400">Verifica que el servidor esté activo e intenta de nuevo.</p>
          </div>
        ) : result.empresas.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Building2 size={24} className="text-slate-400" />
            </div>
            <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {q ? `Sin resultados para "${q}"` : 'Sin proveedores registrados'}
            </p>
            {q && (
              <p className="text-sm text-slate-400">
                Intenta con otros términos o{' '}
                <Link href="/proveedores" className="text-blue-600 dark:text-blue-400 hover:underline">
                  ve todos los proveedores
                </Link>
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Results info */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {q && <>Resultados para <span className="font-medium text-slate-700 dark:text-slate-300">&ldquo;{q}&rdquo;</span> &mdash; </>}
                Página {page} de {totalPages}
              </p>
              {q && (
                <Link href="/proveedores" className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline underline-offset-2">
                  Limpiar búsqueda
                </Link>
              )}
            </div>

            {/* Grid */}
            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              {result.empresas.map(e => (
                <EmpresaCard key={e.id} empresa={e} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination page={page} totalPages={totalPages} buildUrl={buildUrl} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

function EmpresaCard({ empresa }: { empresa: EmpresaCard }) {
  const initials = empresa.nombreComercial
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()

  return (
    <Link
      href={`/empresas/${empresa.slug}`}
      className="flex gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all group"
    >
      {/* Logo / avatar */}
      <div className="w-14 h-14 rounded-xl shrink-0 overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-950/40 dark:to-indigo-950/40 border border-slate-200 dark:border-slate-700">
        {empresa.logoUrl
          ? <img src={empresa.logoUrl} alt="" className="w-full h-full object-cover" />
          : <span className="text-base font-bold text-blue-600 dark:text-blue-400">{initials}</span>
        }
      </div>

      <div className="flex-1 min-w-0">
        {/* Name + badges */}
        <div className="flex flex-wrap items-start gap-1.5 mb-1">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 leading-snug">
            {empresa.nombreComercial}
          </h2>
          {empresa.verified && (
            <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded-full shrink-0">
              <BadgeCheck size={10} /> Verificado
            </span>
          )}
          {empresa.plan !== 'free' && (
            <span className="text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900 px-1.5 py-0.5 rounded-full shrink-0 capitalize">
              {empresa.plan}
            </span>
          )}
        </div>

        {/* Location */}
        {(empresa.ciudad || empresa.estado) && (
          <p className="flex items-center gap-1 text-xs text-slate-400 mb-2">
            <MapPin size={11} />
            {[empresa.ciudad, empresa.estado].filter(Boolean).join(', ')}
          </p>
        )}

        {/* Categories */}
        {empresa.categorias?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {empresa.categorias.slice(0, 3).map(c => (
              <span key={c.slug} className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
                {c.nombre}
              </span>
            ))}
            {empresa.categorias.length > 3 && (
              <span className="text-xs text-slate-400">+{empresa.categorias.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}

function Pagination({
  page,
  totalPages,
  buildUrl,
}: {
  page: number
  totalPages: number
  buildUrl: (p: number) => string
}) {
  // Show at most 7 page numbers with ellipsis
  const range: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) range.push(i)
  } else {
    range.push(1)
    if (page > 3) range.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) range.push(i)
    if (page < totalPages - 2) range.push('...')
    range.push(totalPages)
  }

  return (
    <div className="flex items-center justify-center gap-1">
      <Link
        href={buildUrl(page - 1)}
        aria-disabled={page <= 1}
        className={`p-2 rounded-lg transition-colors ${
          page <= 1
            ? 'pointer-events-none text-slate-300 dark:text-slate-700'
            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
        }`}
      >
        <ChevronLeft size={16} />
      </Link>

      {range.map((r, i) =>
        r === '...' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-slate-400 text-sm select-none">…</span>
        ) : (
          <Link
            key={r}
            href={buildUrl(r)}
            className={`min-w-[36px] h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
              r === page
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            {r}
          </Link>
        )
      )}

      <Link
        href={buildUrl(page + 1)}
        aria-disabled={page >= totalPages}
        className={`p-2 rounded-lg transition-colors ${
          page >= totalPages
            ? 'pointer-events-none text-slate-300 dark:text-slate-700'
            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
        }`}
      >
        <ChevronRight size={16} />
      </Link>
    </div>
  )
}
