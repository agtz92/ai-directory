'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { toast } from 'sonner'
import {
  MessageSquare, Trash2, ChevronDown, ChevronUp,
  Tag, User, Clock, AlertTriangle, MessageCircle,
} from 'lucide-react'
import { STAFF_FORO_POSTS_QUERY } from '@/lib/graphql/queries'
import {
  STAFF_ELIMINAR_FORO_POST_MUTATION,
  STAFF_ELIMINAR_FORO_RESPUESTA_MUTATION,
} from '@/lib/graphql/mutations'

interface ForoRespuesta {
  id: string
  contenido: string
  autorNombre: string
  autorEmail: string
  empresaNombre: string | null
  deleted: boolean
  createdAt: string
}

interface ForoSubcategoriaChip {
  id: string
  nombre: string
  slug: string
}

interface ForoPost {
  id: string
  titulo: string
  contenido: string
  autorNombre: string
  autorEmail: string
  empresaNombre: string | null
  subcategorias: ForoSubcategoriaChip[]
  deleted: boolean
  moderacionStatus: string
  respuestasCount: number
  createdAt: string
  respuestas: ForoRespuesta[]
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  return `hace ${Math.floor(hrs / 24)}d`
}

export default function ForoModerationPage() {
  const [incluirEliminados, setIncluirEliminados] = useState(false)
  const [expandedPost, setExpandedPost] = useState<string | null>(null)

  const { data, loading, refetch } = useQuery<{ staffForoPosts: ForoPost[] }>(
    STAFF_FORO_POSTS_QUERY,
    { variables: { incluirEliminados, limit: 50, offset: 0 }, fetchPolicy: 'network-only' },
  )

  const [eliminarPost] = useMutation(STAFF_ELIMINAR_FORO_POST_MUTATION)
  const [eliminarRespuesta] = useMutation(STAFF_ELIMINAR_FORO_RESPUESTA_MUTATION)

  const posts = data?.staffForoPosts ?? []

  async function handleDeletePost(post: ForoPost) {
    if (!confirm(`¿Eliminar el post "${post.titulo}"?`)) return
    try {
      await eliminarPost({ variables: { postId: post.id } })
      toast.success('Post eliminado')
      refetch()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar')
    }
  }

  async function handleDeleteRespuesta(resp: ForoRespuesta) {
    if (!confirm('¿Eliminar esta respuesta?')) return
    try {
      await eliminarRespuesta({ variables: { respuestaId: resp.id } })
      toast.success('Respuesta eliminada')
      refetch()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar')
    }
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <MessageSquare size={22} className="text-indigo-500" />
            Moderación del Foro
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {posts.length} post{posts.length !== 1 ? 's' : ''} cargados
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={incluirEliminados}
            onChange={(e) => { setIncluirEliminados(e.target.checked); refetch() }}
            className="rounded"
          />
          Mostrar eliminados
        </label>
      </div>

      {/* Post list */}
      {loading ? (
        <div className="text-center py-20 text-slate-400">Cargando...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <MessageSquare size={40} className="mx-auto mb-4 opacity-40" />
          <p>No hay posts en el foro.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const isExpanded = expandedPost === post.id

            return (
              <div
                key={post.id}
                className={`rounded-xl border ${
                  post.deleted
                    ? 'border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                }`}
              >
                {/* Post header */}
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {post.deleted && (
                          <span className="inline-flex items-center gap-1 text-xs bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">
                            <AlertTriangle size={10} />
                            Eliminado
                          </span>
                        )}
                        {post.subcategorias.map((s) => (
                          <span key={s.id} className="inline-flex items-center gap-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
                            <Tag size={10} />
                            {s.nombre}
                          </span>
                        ))}
                      </div>
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                        {post.titulo}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {post.contenido}
                      </p>
                      <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-slate-400 dark:text-slate-500">
                        <span className="flex items-center gap-1">
                          <User size={10} />
                          {post.empresaNombre ?? post.autorNombre}
                          {post.autorEmail && (
                            <span className="text-slate-300 dark:text-slate-600">
                              ({post.autorEmail})
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {timeAgo(post.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle size={10} />
                          {post.respuestasCount} respuesta{post.respuestasCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {!post.deleted && (
                        <button
                          onClick={() => handleDeletePost(post)}
                          title="Eliminar post"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                      {post.respuestas.length > 0 && (
                        <button
                          onClick={() => setExpandedPost(isExpanded ? null : post.id)}
                          title="Ver respuestas"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded replies */}
                {isExpanded && post.respuestas.length > 0 && (
                  <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-3 space-y-3">
                    {post.respuestas.map((r) => (
                      <div
                        key={r.id}
                        className={`rounded-lg px-4 py-3 ${
                          r.deleted
                            ? 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40'
                            : 'bg-slate-50 dark:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            {r.deleted && (
                              <span className="inline-flex items-center gap-1 text-xs text-red-500 mb-1">
                                <AlertTriangle size={9} />
                                Eliminado
                              </span>
                            )}
                            <p className="text-sm text-slate-700 dark:text-slate-300">
                              {r.contenido}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
                              <span className="flex items-center gap-1">
                                <User size={9} />
                                {r.empresaNombre ?? r.autorNombre}
                                {r.autorEmail && (
                                  <span className="text-slate-300 dark:text-slate-600">
                                    ({r.autorEmail})
                                  </span>
                                )}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock size={9} />
                                {timeAgo(r.createdAt)}
                              </span>
                            </div>
                          </div>
                          {!r.deleted && (
                            <button
                              onClick={() => handleDeleteRespuesta(r)}
                              title="Eliminar respuesta"
                              className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
