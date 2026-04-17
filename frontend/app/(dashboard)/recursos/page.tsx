'use client'

import Link from 'next/link'
import { useQuery } from '@apollo/client'
import { useAuthStore } from '@/lib/auth-store'
import { ARTICULOS_QUERY } from '@/lib/graphql/queries'
import { BookOpen, Calendar, User, ChevronRight } from 'lucide-react'

type Post = {
  id: string
  titulo: string
  slug: string
  extracto: string
  imagenPortada: string
  autorNombre: string
  publishedAt: string | null
}

export default function RecursosPage() {
  const token = useAuthStore((s) => s.token)

  const { data, loading } = useQuery(ARTICULOS_QUERY, {
    variables: { limit: 12, offset: 0 },
    skip: !token,
    fetchPolicy: 'cache-and-network',
  })

  const posts: Post[] = data?.articulos?.posts ?? []
  const total: number = data?.articulos?.total ?? 0

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          <BookOpen size={12} />
          Recursos
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Estrategias y alianzas
        </h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400 text-sm">
          Artículos para hacer crecer tu empresa y generar nuevas oportunidades.
        </p>
      </div>

      {loading && posts.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 text-slate-400 dark:text-slate-500">
          <BookOpen size={40} className="mx-auto mb-4 opacity-40" />
          <p>Próximamente — primeros recursos en camino.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/recursos/${post.slug}`}
                className="group flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-md dark:hover:shadow-slate-900/30 transition-shadow bg-white dark:bg-slate-900"
              >
                {post.imagenPortada && (
                  <div className="h-36 overflow-hidden">
                    <img
                      src={post.imagenPortada}
                      alt={post.titulo}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                )}
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors line-clamp-2">
                    {post.titulo}
                  </h3>
                  {post.extracto && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 flex-1">
                      {post.extracto}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                      <span className="flex items-center gap-1">
                        <User size={11} />
                        {post.autorNombre}
                      </span>
                      {post.publishedAt && (
                        <span className="flex items-center gap-1">
                          <Calendar size={11} />
                          {new Date(post.publishedAt).toLocaleDateString('es-MX', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                    <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 group-hover:text-violet-500 transition-colors" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <p className="text-xs text-slate-400 text-center mt-6">
            {total} recurso{total !== 1 ? 's' : ''} disponible{total !== 1 ? 's' : ''}
          </p>
        </>
      )}
    </div>
  )
}
