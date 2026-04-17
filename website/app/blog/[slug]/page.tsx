import { notFound } from 'next/navigation'
import Link from 'next/link'
import { gql } from '@/lib/graphql'
import { BLOG_POST_QUERY, BLOG_POSTS_QUERY } from '@/lib/graphql/queries'
import { ArrowLeft, Calendar, User } from 'lucide-react'
import MarkdownRenderer from '@/app/components/MarkdownRenderer'

export const dynamic = 'force-dynamic'

type Post = {
  id: string
  titulo: string
  slug: string
  extracto: string
  contenido: string
  imagenPortada: string
  autorNombre: string
  publishedAt: string | null
}

export async function generateStaticParams() {
  try {
    const data = await gql<{ blogPosts: { posts: { slug: string }[] } }>(
      BLOG_POSTS_QUERY,
      { limit: 50, offset: 0 },
      3600,
    )
    return data.blogPosts.posts.map((p) => ({ slug: p.slug }))
  } catch {
    return []
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await gql<{ blogPost: Post | null }>(BLOG_POST_QUERY, { slug }, 0)
  const post = data.blogPost

  if (!post) notFound()

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      {/* Back */}
      <Link
        href="/blog"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 mb-6 transition-colors"
      >
        <ArrowLeft size={14} />
        Volver al blog
      </Link>

      {/* Cover */}
      {post.imagenPortada && (
        <div className="rounded-2xl overflow-hidden mb-8 h-56 sm:h-72">
          <img
            src={post.imagenPortada}
            alt={post.titulo}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Header */}
      <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
        {post.titulo}
      </h1>

      {post.extracto && (
        <p className="mt-3 text-lg text-slate-500 dark:text-slate-400 leading-relaxed">
          {post.extracto}
        </p>
      )}

      <div className="flex items-center gap-4 mt-4 pb-6 border-b border-slate-200 dark:border-slate-800 text-sm text-slate-400 dark:text-slate-500">
        <span className="flex items-center gap-1.5">
          <User size={13} />
          {post.autorNombre}
        </span>
        {post.publishedAt && (
          <span className="flex items-center gap-1.5">
            <Calendar size={13} />
            {new Date(post.publishedAt).toLocaleDateString('es-MX', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </span>
        )}
      </div>

      {/* Content */}
      <MarkdownRenderer content={post.contenido} className="mt-8" />
    </main>
  )
}
