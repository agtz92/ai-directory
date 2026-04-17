'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@apollo/client'
import { useAuthStore } from '@/lib/auth-store'
import { ARTICULO_QUERY } from '@/lib/graphql/queries'
import { ArrowLeft, Calendar, User } from 'lucide-react'
import MarkdownRenderer from '@/components/MarkdownRenderer'

export default function ArticuloPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const token = useAuthStore((s) => s.token)

  const { data, loading } = useQuery(ARTICULO_QUERY, {
    variables: { slug },
    skip: !token || !slug,
    fetchPolicy: 'cache-first',
  })

  const post = data?.articulo

  if (loading && !post) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4 animate-pulse">
        <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-8 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl" />
      </div>
    )
  }

  if (!post) {
    return (
      <div className="p-6 text-center py-20 text-slate-400 dark:text-slate-500">
        <p>Artículo no encontrado.</p>
        <button
          onClick={() => router.push('/recursos')}
          className="mt-4 text-violet-600 hover:underline text-sm"
        >
          Volver a Recursos
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.push('/recursos')}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 mb-6 transition-colors"
      >
        <ArrowLeft size={14} />
        Volver a Recursos
      </button>

      {/* Cover */}
      {post.imagenPortada && (
        <div className="rounded-xl overflow-hidden mb-8 h-52">
          <img
            src={post.imagenPortada}
            alt={post.titulo}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Header */}
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
        {post.titulo}
      </h1>

      {post.extracto && (
        <p className="mt-2 text-slate-500 dark:text-slate-400 leading-relaxed">
          {post.extracto}
        </p>
      )}

      <div className="flex items-center gap-4 mt-4 pb-5 border-b border-slate-200 dark:border-slate-800 text-sm text-slate-400 dark:text-slate-500">
        <span className="flex items-center gap-1.5">
          <User size={13} />
          {post.autorNombre}
        </span>
        {post.publishedAt && (
          <span className="flex items-center gap-1.5">
            <Calendar size={13} />
            {new Date(post.publishedAt).toLocaleDateString('es-MX', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </span>
        )}
      </div>

      {/* Content */}
      <MarkdownRenderer content={post.contenido} className="mt-6" />
    </div>
  )
}
