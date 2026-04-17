import { gql } from '@/lib/graphql'
import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MapPin, BadgeCheck, ChevronRight, ChevronLeft } from 'lucide-react'

export const revalidate = 3600

interface Props {
  params: Promise<{ categoria_slug: string }>
  searchParams: Promise<{ ciudad?: string; page?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { categoria_slug } = await params
  const nombre = categoria_slug.replace(/-/g, ' ')
  return {
    title: `Proveedores de ${nombre} en México | Directorio Industrial`,
    description: `Encuentra proveedores de ${nombre} en México. Solicita cotizaciones directamente.`,
  }
}

export default async function CategoriaPage({ params, searchParams }: Props) {
  const { categoria_slug } = await params
  const { ciudad = '', page = '1' } = await searchParams
  const offset = (parseInt(page) - 1) * 20

  let subcategorias: any[] = []
  let result: any = { empresas: [], total: 0, hasMore: false }

  try {
    const [subData, dirData] = await Promise.all([
      gql<{ subcategorias: any[] }>(`
        query Sub($slug: String!) {
          subcategorias(categoriaSlug: $slug) { id nombre slug }
        }
      `, { slug: categoria_slug }),
      gql<{ directorio: any }>(`
        query Dir($catSlug: String!, $ciudad: String!, $limit: Int!, $offset: Int!) {
          directorio(categoriaSlug: $catSlug, ciudad: $ciudad, limit: $limit, offset: $offset) {
            total hasMore
            empresas {
              id nombreComercial slug ciudad estado plan scoreCompletitud verified logoUrl
              categorias { nombre slug }
            }
          }
        }
      `, { catSlug: categoria_slug, ciudad, limit: 20, offset }),
    ])
    subcategorias = subData.subcategorias
    result = dirData.directorio
  } catch {}

  if (result.total === 0 && offset === 0 && subcategorias.length === 0) notFound()

  const nombre = categoria_slug.replace(/-/g, ' ')
  const pageNum = parseInt(page)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 text-xs text-slate-400 mb-4">
            <Link href="/" className="hover:text-blue-600 transition-colors">Inicio</Link>
            <ChevronRight size={12} />
            <Link href="/categorias" className="hover:text-blue-600 transition-colors">Categorías</Link>
            <ChevronRight size={12} />
            <span className="text-slate-700 dark:text-slate-300 capitalize font-medium">{nombre}</span>
          </nav>

          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 capitalize mb-1">
            Proveedores de {nombre}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            <span className="font-semibold text-slate-700 dark:text-slate-300">{result.total}</span> empresa{result.total !== 1 ? 's' : ''} encontradas
            {ciudad && <> en <span className="font-medium">{ciudad}</span></>}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 flex gap-8">
        {/* Sidebar */}
        {subcategorias.length > 0 && (
          <aside className="w-52 shrink-0 hidden md:block">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 px-1">
              Subcategorías
            </p>
            <nav className="space-y-0.5">
              {subcategorias.map((s) => (
                <Link
                  key={s.id}
                  href={`/categorias/${categoria_slug}/${s.slug}`}
                  className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 px-3 py-2 rounded-lg transition-colors group"
                >
                  <span className="truncate">{s.nombre}</span>
                  <ChevronRight size={13} className="text-slate-300 group-hover:text-blue-400 shrink-0" />
                </Link>
              ))}
            </nav>
          </aside>
        )}

        {/* Results */}
        <div className="flex-1 min-w-0">
          {result.empresas.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <p className="text-base font-medium">No hay empresas en esta categoría aún.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {result.empresas.map((e: any) => (
                <EmpresaCard key={e.id} empresa={e} categoriaSlug={categoria_slug} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {(result.hasMore || pageNum > 1) && (
            <div className="flex items-center gap-3 mt-8">
              {pageNum > 1 && (
                <Link
                  href={`/categorias/${categoria_slug}?page=${pageNum - 1}${ciudad ? `&ciudad=${ciudad}` : ''}`}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                >
                  <ChevronLeft size={15} /> Anterior
                </Link>
              )}
              {result.hasMore && (
                <Link
                  href={`/categorias/${categoria_slug}?page=${pageNum + 1}${ciudad ? `&ciudad=${ciudad}` : ''}`}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                >
                  Siguiente <ChevronRight size={15} />
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EmpresaCard({ empresa, categoriaSlug }: { empresa: any; categoriaSlug: string }) {
  return (
    <Link
      href={`/empresas/${empresa.slug}`}
      className="flex items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all group"
    >
      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-700">
        {empresa.logoUrl
          ? <img src={empresa.logoUrl} alt="" className="w-full h-full object-cover" />
          : <span className="text-xl">🏭</span>
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
            {empresa.nombreComercial}
          </h2>
          {empresa.verified && (
            <span className="flex items-center gap-1 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 px-2 py-0.5 rounded-full shrink-0">
              <BadgeCheck size={11} /> Verificado
            </span>
          )}
          {empresa.plan !== 'free' && (
            <span className="text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900 px-2 py-0.5 rounded-full shrink-0 capitalize">
              {empresa.plan}
            </span>
          )}
        </div>
        {(empresa.ciudad || empresa.estado) && (
          <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <MapPin size={11} />
            {[empresa.ciudad, empresa.estado].filter(Boolean).join(', ')}
          </p>
        )}
      </div>
    </Link>
  )
}
