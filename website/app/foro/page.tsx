import Link from 'next/link'
import { gql } from '@/lib/graphql'
import { FORO_POSTS_QUERY } from '@/lib/graphql/queries'
import { MessageSquare, PlusCircle, Tag, User, Clock } from 'lucide-react'
import SubcategoriaSelect from './SubcategoriaSelect'

type SubcategoriaChip = { id: string; nombre: string; slug: string }

type ForoPost = {
  id: string
  titulo: string
  autorNombre: string
  empresaNombre: string | null
  empresaSlug: string | null
  subcategorias: SubcategoriaChip[]
  subcategoriaNombre: string
  subcategoriaSlug: string
  respuestasCount: number
  createdAt: string
}

type ForoPostsData = {
  foroPosts: {
    total: number
    hasMore: boolean
    posts: ForoPost[]
  }
}

export const dynamic = 'force-dynamic'

export default async function ForoPage({
  searchParams,
}: {
  searchParams: Promise<{ subcategoria?: string; offset?: string }>
}) {
  const params = await searchParams
  const subcategoriaSlug = params.subcategoria ?? null
  const offset = parseInt(params.offset ?? '0', 10)
  const limit = 20

  // Fetch posts for the current filter AND all posts (limit 200) to build sidebar
  const [postsData, allPostsData] = await Promise.all([
    gql<ForoPostsData>(FORO_POSTS_QUERY, { subcategoriaSlug, limit, offset }, 0),
    gql<ForoPostsData>(FORO_POSTS_QUERY, { limit: 200, offset: 0 }, 60),
  ])

  const { posts, total, hasMore } = postsData.foroPosts

  // Derive unique subcategorias from all posts for the sidebar
  const subcategoriaMap = new Map<string, string>()
  for (const p of allPostsData.foroPosts.posts) {
    if (!subcategoriaMap.has(p.subcategoriaSlug)) {
      subcategoriaMap.set(p.subcategoriaSlug, p.subcategoriaNombre)
    }
  }
  const subcategorias = Array.from(subcategoriaMap.entries())
    .map(([slug, nombre]) => ({ slug, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-semibold px-3 py-1 rounded-full mb-3">
            <MessageSquare size={13} />
            Foro Industrial
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Preguntas y discusiones
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Resuelve dudas y comparte conocimiento con la comunidad industrial.
          </p>
        </div>
        <Link
          href="/foro/nueva"
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shrink-0"
        >
          <PlusCircle size={16} />
          Nueva pregunta
        </Link>
      </div>

      <div className="flex gap-6">
        {/* Sidebar — subcategory filter */}
        <aside className="hidden lg:block w-56 shrink-0">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
            Filtrar por subcategoría
          </p>
          <nav className="space-y-0.5">
            <Link
              href="/foro"
              className={`block text-sm px-3 py-2 rounded-lg transition-colors ${
                !subcategoriaSlug
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Todas las categorías
            </Link>
            {subcategorias.map((s) => (
              <Link
                key={s.slug}
                href={`/foro?subcategoria=${s.slug}`}
                className={`block text-sm px-3 py-2 rounded-lg transition-colors ${
                  subcategoriaSlug === s.slug
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {s.nombre}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Post list */}
        <section className="flex-1 min-w-0">
          {/* Mobile subcategory select */}
          <div className="lg:hidden mb-4">
            <SubcategoriaSelect subcategorias={subcategorias} current={subcategoriaSlug} />
          </div>

          {posts.length === 0 ? (
            <div className="text-center py-20 text-slate-400 dark:text-slate-500">
              <MessageSquare size={40} className="mx-auto mb-4 opacity-40" />
              <p className="font-medium">No hay preguntas aún.</p>
              <p className="text-sm mt-1">
                ¿Tienes una duda?{' '}
                <Link href="/foro/nueva" className="text-indigo-600 hover:underline">
                  Sé el primero en preguntar
                </Link>
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="group relative rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 hover:shadow-md dark:hover:shadow-slate-900/30 transition-shadow"
                >
                  {/* Clickable overlay for the whole card */}
                  <Link href={`/foro/${post.id}`} className="absolute inset-0 rounded-xl" aria-label={post.titulo} />

                  <div className="pointer-events-none flex items-start justify-between gap-3">
                    <h2 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                      {post.titulo}
                    </h2>
                    <span className="shrink-0 flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      <MessageSquare size={12} />
                      {post.respuestasCount}
                    </span>
                  </div>
                  <div className="pointer-events-none flex items-center gap-2 mt-2 flex-wrap">
                    {post.subcategorias.map((s) => (
                      <Link
                        key={s.id}
                        href={`/foro?subcategoria=${s.slug}`}
                        className="pointer-events-auto inline-flex items-center gap-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 px-2 py-0.5 rounded-full transition-colors"
                      >
                        <Tag size={10} />
                        {s.nombre}
                      </Link>
                    ))}
                    <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                      <User size={10} />
                      {post.empresaNombre ? (
                        <Link
                          href={`/empresas/${post.empresaSlug}`}
                          className="pointer-events-auto hover:underline text-indigo-600 dark:text-indigo-400"
                        >
                          {post.empresaNombre}
                        </Link>
                      ) : (
                        post.autorNombre
                      )}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                      <Clock size={10} />
                      {new Date(post.createdAt).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {(offset > 0 || hasMore) && (
            <div className="flex justify-between items-center mt-6">
              {offset > 0 ? (
                <Link
                  href={`/foro?${subcategoriaSlug ? `subcategoria=${subcategoriaSlug}&` : ''}offset=${Math.max(0, offset - limit)}`}
                  className="text-sm text-indigo-600 hover:underline"
                >
                  ← Anteriores
                </Link>
              ) : (
                <span />
              )}
              {hasMore && (
                <Link
                  href={`/foro?${subcategoriaSlug ? `subcategoria=${subcategoriaSlug}&` : ''}offset=${offset + limit}`}
                  className="text-sm text-indigo-600 hover:underline"
                >
                  Ver más →
                </Link>
              )}
            </div>
          )}

          {total > 0 && (
            <p className="text-xs text-slate-400 text-center mt-6">
              {total} pregunta{total !== 1 ? 's' : ''} en el foro
            </p>
          )}
        </section>
      </div>
    </main>
  )
}
