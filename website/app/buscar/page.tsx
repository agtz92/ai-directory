import { gql } from '@/lib/graphql'
import Link from 'next/link'
import type { Metadata } from 'next'
import { MapPin, Tag, BadgeCheck } from 'lucide-react'
import SearchBar from '../components/SearchBar'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Buscar proveedores | Directorio Industrial MX',
}

interface Props {
  searchParams: Promise<{ q?: string; ciudad?: string; estado?: string }>
}

export default async function BuscarPage({ searchParams }: Props) {
  const { q = '', ciudad = '', estado = '' } = await searchParams

  let result: any = { empresas: [], total: 0 }
  try {
    const data = await gql<{ directorio: any }>(`
      query($search: String!, $ciudad: String!, $estado: String!) {
        directorio(search: $search, ciudad: $ciudad, estado: $estado, limit: 30) {
          total hasMore
          empresas {
            id nombreComercial slug ciudad estado plan scoreCompletitud verified logoUrl
            categorias { nombre slug }
          }
        }
      }
    `, { search: q, ciudad, estado }, 0)
    result = data.directorio
  } catch {}

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Search header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-6">
        <div className="max-w-3xl mx-auto">
          <SearchBar defaultValue={q} />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Results count */}
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          {q
            ? <><span className="font-semibold text-slate-900 dark:text-slate-100">{result.total}</span> empresa{result.total !== 1 ? 's' : ''} para &ldquo;{q}&rdquo;</>
            : 'Escribe algo para buscar proveedores'
          }
        </p>

        {result.empresas.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Tag size={24} className="text-slate-400" />
            </div>
            <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Sin resultados</p>
            <p className="text-sm text-slate-400">
              Intenta con otros términos o{' '}
              <Link href="/categorias" className="text-blue-600 dark:text-blue-400 hover:underline">
                explora por categoría
              </Link>
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {result.empresas.map((e: any) => (
              <EmpresaCard key={e.id} empresa={e} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EmpresaCard({ empresa }: { empresa: any }) {
  return (
    <Link
      href={`/empresas/${empresa.slug}`}
      className="flex items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md dark:hover:shadow-blue-950/20 transition-all group"
    >
      {/* Logo */}
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
          <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            <MapPin size={11} />
            {[empresa.ciudad, empresa.estado].filter(Boolean).join(', ')}
          </p>
        )}

        <div className="flex flex-wrap gap-1">
          {empresa.categorias?.slice(0, 3).map((c: any) => (
            <span key={c.slug} className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
              {c.nombre}
            </span>
          ))}
        </div>
      </div>
    </Link>
  )
}
