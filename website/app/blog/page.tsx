import Link from 'next/link'
import { gql } from '@/lib/graphql'
import { BLOG_POSTS_QUERY } from '@/lib/graphql/queries'
import { Newspaper, Calendar, User } from 'lucide-react'

type Post = {
  id: string
  titulo: string
  slug: string
  extracto: string
  imagenPortada: string
  autorNombre: string
  publishedAt: string | null
}

type BlogPostsData = {
  blogPosts: {
    total: number
    hasMore: boolean
    posts: Post[]
  }
}

export const dynamic = 'force-dynamic'

export default async function BlogPage() {
  let posts: Post[] = []
  let total = 0

  const data = await gql<BlogPostsData>(BLOG_POSTS_QUERY, { limit: 12, offset: 0 }, 0)
  posts = data.blogPosts.posts
  total = data.blogPosts.total

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-xs font-semibold px-3 py-1 rounded-full mb-4">
          <Newspaper size={13} />
          Blog Industrial
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          Noticias e insights del sector
        </h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400 max-w-xl">
          Tendencias, análisis y novedades del mercado industrial mexicano.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-20 text-slate-400 dark:text-slate-500">
          <Newspaper size={40} className="mx-auto mb-4 opacity-40" />
          <p>Próximamente — primeros artículos en camino.</p>
        </div>
      ) : (
        <>
          {/* Featured post (first) */}
          {posts[0] && (
            <Link
              href={`/blog/${posts[0].slug}`}
              className="group block mb-8 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 hover:shadow-lg dark:hover:shadow-slate-900/40 transition-shadow"
            >
              {posts[0].imagenPortada && (
                <div className="relative h-52 sm:h-64 overflow-hidden">
                  <img
                    src={posts[0].imagenPortada}
                    alt={posts[0].titulo}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              )}
              <div className={`p-6 bg-white dark:bg-slate-900 ${!posts[0].imagenPortada ? '' : ''}`}>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {posts[0].titulo}
                </h2>
                {posts[0].extracto && (
                  <p className="mt-2 text-slate-500 dark:text-slate-400 text-sm line-clamp-2">
                    {posts[0].extracto}
                  </p>
                )}
                <PostMeta post={posts[0]} />
              </div>
            </Link>
          )}

          {/* Grid */}
          {posts.length > 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {posts.slice(1).map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="group flex flex-col rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 hover:shadow-md dark:hover:shadow-slate-900/30 transition-shadow bg-white dark:bg-slate-900"
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
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                      {post.titulo}
                    </h3>
                    {post.extracto && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 flex-1">
                        {post.extracto}
                      </p>
                    )}
                    <PostMeta post={post} />
                  </div>
                </Link>
              ))}
            </div>
          )}

          <p className="text-xs text-slate-400 text-center mt-8">
            {total} artículo{total !== 1 ? 's' : ''} publicado{total !== 1 ? 's' : ''}
          </p>
        </>
      )}
    </main>
  )
}

function PostMeta({ post }: { post: Post }) {
  return (
    <div className="flex items-center gap-3 mt-3 text-xs text-slate-400 dark:text-slate-500">
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
  )
}
