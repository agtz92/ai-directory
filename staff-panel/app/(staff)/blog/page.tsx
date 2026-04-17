'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@apollo/client'
import { useAuthStore } from '@/lib/auth-store'
import { useStaffRole } from '@/lib/use-staff-role'
import { STAFF_POSTS_QUERY } from '@/lib/graphql/queries'
import { STAFF_PUBLICAR_POST_MUTATION, STAFF_ARCHIVAR_POST_MUTATION, STAFF_ELIMINAR_POST_MUTATION } from '@/lib/graphql/mutations'
import { Plus, Eye, Archive, Trash2, Edit3, Globe, Briefcase } from 'lucide-react'
import { toast } from 'sonner'

type Post = {
  id: string
  titulo: string
  slug: string
  extracto: string
  target: string
  status: string
  autorNombre: string
  createdAt: string
  publishedAt: string | null
}

const STATUS_BADGE: Record<string, string> = {
  draft:     'bg-yellow-100 text-yellow-800',
  published: 'bg-green-100 text-green-800',
  archived:  'bg-gray-100 text-gray-600',
}

const STATUS_LABEL: Record<string, string> = {
  draft:     'Borrador',
  published: 'Publicado',
  archived:  'Archivado',
}

const TARGET_LABEL: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  industry: { label: 'Industria', cls: 'bg-blue-100 text-blue-800', icon: <Globe size={11} /> },
  business: { label: 'Negocios',  cls: 'bg-purple-100 text-purple-800', icon: <Briefcase size={11} /> },
}

const TABS = ['Todos', 'Borradores', 'Publicados', 'Archivados'] as const
const TAB_STATUS: Record<string, string> = {
  Todos: '', Borradores: 'draft', Publicados: 'published', Archivados: 'archived',
}

export default function BlogListPage() {
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const { isAdmin } = useStaffRole()

  const [tab, setTab] = useState<typeof TABS[number]>('Todos')
  const [targetFilter, setTargetFilter] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { data, loading, refetch } = useQuery(STAFF_POSTS_QUERY, {
    variables: { target: targetFilter, status: TAB_STATUS[tab], limit: 50, offset: 0 },
    skip: !token,
    fetchPolicy: 'cache-and-network',
  })

  const [publicarPost] = useMutation(STAFF_PUBLICAR_POST_MUTATION)
  const [archivarPost] = useMutation(STAFF_ARCHIVAR_POST_MUTATION)
  const [eliminarPost] = useMutation(STAFF_ELIMINAR_POST_MUTATION)

  const posts: Post[] = data?.staffPosts?.posts ?? []
  const total: number = data?.staffPosts?.total ?? 0

  const handlePublicar = async (postId: string) => {
    try {
      await publicarPost({ variables: { postId } })
      toast.success('Post publicado')
      refetch()
    } catch { toast.error('Error al publicar') }
  }

  const handleArchivar = async (postId: string) => {
    try {
      await archivarPost({ variables: { postId } })
      toast.success('Post archivado')
      refetch()
    } catch { toast.error('Error al archivar') }
  }

  const handleEliminar = async (postId: string) => {
    try {
      await eliminarPost({ variables: { postId } })
      toast.success('Post eliminado')
      setDeleteConfirm(null)
      refetch()
    } catch { toast.error('Error al eliminar') }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Blog</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} artículo{total !== 1 ? 's' : ''} en total</p>
        </div>
        <button
          onClick={() => router.push('/blog/new')}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={15} />
          Nuevo artículo
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        {/* Status tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Target filter */}
        <select
          value={targetFilter}
          onChange={(e) => setTargetFilter(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Todos los destinos</option>
          <option value="industry">Industria (sitio web)</option>
          <option value="business">Negocios (panel empresa)</option>
        </select>
      </div>

      {/* Table */}
      {loading && posts.length === 0 ? (
        <div className="text-sm text-gray-400 text-center py-16">Cargando...</div>
      ) : posts.length === 0 ? (
        <div className="text-sm text-gray-400 text-center py-16">
          No hay artículos.{' '}
          <button onClick={() => router.push('/blog/new')} className="text-blue-600 hover:underline">
            Crear el primero
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Artículo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Destino</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Autor</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Fecha</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {posts.map((post) => {
                const tgt = TARGET_LABEL[post.target]
                return (
                  <tr key={post.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 line-clamp-1">{post.titulo}</p>
                      {post.extracto && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{post.extracto}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {tgt && (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${tgt.cls}`}>
                          {tgt.icon}
                          {tgt.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[post.status] ?? ''}`}>
                        {STATUS_LABEL[post.status] ?? post.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{post.autorNombre}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {post.publishedAt
                        ? new Date(post.publishedAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
                        : new Date(post.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => router.push(`/blog/${post.id}`)}
                          title="Editar"
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit3 size={14} />
                        </button>
                        {isAdmin && post.status === 'draft' && (
                          <button
                            onClick={() => handlePublicar(post.id)}
                            title="Publicar"
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          >
                            <Eye size={14} />
                          </button>
                        )}
                        {isAdmin && post.status === 'published' && (
                          <button
                            onClick={() => handleArchivar(post.id)}
                            title="Archivar"
                            className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                          >
                            <Archive size={14} />
                          </button>
                        )}
                        {isAdmin && deleteConfirm === post.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEliminar(post.id)}
                              className="text-xs text-red-600 font-medium hover:underline"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="text-xs text-gray-400 hover:underline"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : isAdmin ? (
                          <button
                            onClick={() => setDeleteConfirm(post.id)}
                            title="Eliminar"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
