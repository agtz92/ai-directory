import { notFound } from 'next/navigation'
import Link from 'next/link'
import { gql } from '@/lib/graphql'
import { FORO_POST_QUERY } from '@/lib/graphql/queries'
import { ChevronLeft, Tag, User, Clock, MessageSquare } from 'lucide-react'
import ReplyForm from './ReplyForm'

type Respuesta = {
  id: string
  contenido: string
  autorNombre: string
  empresaNombre: string | null
  empresaSlug: string | null
  createdAt: string
}

type SubcategoriaChip = { id: string; nombre: string; slug: string }

type ForoPostDetail = {
  id: string
  titulo: string
  contenido: string
  autorNombre: string
  empresaNombre: string | null
  empresaSlug: string | null
  subcategorias: SubcategoriaChip[]
  subcategoriaNombre: string
  subcategoriaSlug: string
  createdAt: string
  respuestas: Respuesta[]
}

type ForoPostData = {
  foroPost: ForoPostDetail | null
}

export const dynamic = 'force-dynamic'

export default async function ForoPostPage({
  params,
}: {
  params: Promise<{ post_id: string }>
}) {
  const { post_id } = await params
  const id = parseInt(post_id, 10)
  if (isNaN(id)) notFound()

  const data = await gql<ForoPostData>(FORO_POST_QUERY, { id }, 0)
  const post = data.foroPost
  if (!post) notFound()

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <Link
        href="/foro"
        className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-6 transition-colors"
      >
        <ChevronLeft size={15} />
        Volver al foro
      </Link>

      {/* Post */}
      <article className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 mb-6">
        {/* Subcategoria chips */}
        <div className="flex flex-wrap gap-2 mb-3">
          {post.subcategorias.map((s) => (
            <Link
              key={s.id}
              href={`/foro?subcategoria=${s.slug}`}
              className="inline-flex items-center gap-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <Tag size={10} />
              {s.nombre}
            </Link>
          ))}
        </div>

        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
          {post.titulo}
        </h1>

        <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
          {post.contenido}
        </p>

        <div className="flex items-center gap-4 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500">
          <span className="flex items-center gap-1">
            <User size={11} />
            {post.empresaNombre ? (
              <Link
                href={`/empresas/${post.empresaSlug}`}
                className="text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {post.empresaNombre}
              </Link>
            ) : (
              post.autorNombre
            )}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {new Date(post.createdAt).toLocaleDateString('es-MX', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare size={11} />
            {post.respuestas.length} respuesta{post.respuestas.length !== 1 ? 's' : ''}
          </span>
        </div>
      </article>

      {/* Replies */}
      {post.respuestas.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
            Respuestas ({post.respuestas.length})
          </h2>
          <div className="space-y-3">
            {post.respuestas.map((r) => (
              <div
                key={r.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-5 py-4"
              >
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap text-sm leading-relaxed">
                  {r.contenido}
                </p>
                <div className="flex items-center gap-3 mt-3 text-xs text-slate-400 dark:text-slate-500">
                  <span className="flex items-center gap-1">
                    <User size={10} />
                    {r.empresaNombre ? (
                      <Link
                        href={`/empresas/${r.empresaSlug}`}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {r.empresaNombre}
                      </Link>
                    ) : (
                      r.autorNombre
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {new Date(r.createdAt).toLocaleDateString('es-MX', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Reply form — client island */}
      <ReplyForm postId={id} />
    </main>
  )
}
