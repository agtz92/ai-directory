import { gql } from '@/lib/graphql'
import Link from 'next/link'
import type { Metadata } from 'next'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Todas las Categorías | Directorio Industrial MX',
  description: 'Explora todas las categorías de proveedores industriales en México.',
}

interface Categoria {
  id: string; nombre: string; slug: string; icono: string; descripcion: string
}

const COLORS = [
  'from-blue-500 to-blue-600',
  'from-violet-500 to-violet-600',
  'from-emerald-500 to-emerald-600',
  'from-amber-500 to-amber-600',
  'from-rose-500 to-rose-600',
  'from-cyan-500 to-cyan-600',
  'from-indigo-500 to-indigo-600',
  'from-teal-500 to-teal-600',
]

export default async function CategoriasPage() {
  let categorias: Categoria[] = []
  try {
    const data = await gql<{ categorias: Categoria[] }>(
      `query { categorias(activasOnly: true) { id nombre slug icono descripcion } }`
    )
    categorias = data.categorias
  } catch {}

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-10">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mb-1">Categorías del directorio</h1>
          <p className="text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-300">{categorias.length.toLocaleString()}</span> categorías industriales
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {categorias.map((cat) => {
            const grad = COLORS[parseInt(cat.id) % COLORS.length]
            return (
              <Link
                key={cat.id}
                href={`/categorias/${cat.slug}`}
                className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-transparent hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden relative"
              >
                {/* Color accent top bar */}
                <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${grad} opacity-0 group-hover:opacity-100 transition-opacity`} />

                <div className="text-2xl mb-2">{cat.icono || '🏭'}</div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 leading-snug line-clamp-2">
                  {cat.nombre}
                </p>
                {cat.descripcion && (
                  <p className="text-xs text-slate-400 mt-1 line-clamp-1 hidden group-hover:block">{cat.descripcion}</p>
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
