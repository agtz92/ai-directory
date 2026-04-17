'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useQuery, useMutation } from '@apollo/client'
import { useAuthStore } from '@/lib/auth-store'
import { useStaffRole } from '@/lib/use-staff-role'
import { STAFF_POST_QUERY } from '@/lib/graphql/queries'
import {
  STAFF_ACTUALIZAR_POST_MUTATION, STAFF_PUBLICAR_POST_MUTATION,
  STAFF_ARCHIVAR_POST_MUTATION, STAFF_ELIMINAR_POST_MUTATION,
} from '@/lib/graphql/mutations'
import { Eye, EyeOff, ArrowLeft, Globe, Briefcase, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'

export default function EditPostPage() {
  const router = useRouter()
  const { postId } = useParams<{ postId: string }>()
  const token = useAuthStore((s) => s.token)
  const { isAdmin } = useStaffRole()

  const { data, loading } = useQuery(STAFF_POST_QUERY, {
    variables: { postId },
    skip: !token || !postId,
    fetchPolicy: 'network-only',
  })

  const [titulo, setTitulo] = useState('')
  const [target, setTarget] = useState<'industry' | 'business'>('industry')
  const [extracto, setExtracto] = useState('')
  const [imagenPortada, setImagenPortada] = useState('')
  const [contenido, setContenido] = useState('')
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const post = data?.staffPost

  useEffect(() => {
    if (post) {
      setTitulo(post.titulo)
      setTarget(post.target as 'industry' | 'business')
      setExtracto(post.extracto ?? '')
      setImagenPortada(post.imagenPortada ?? '')
      setContenido(post.contenido)
    }
  }, [post])

  const [actualizarPost] = useMutation(STAFF_ACTUALIZAR_POST_MUTATION)
  const [publicarPost] = useMutation(STAFF_PUBLICAR_POST_MUTATION)
  const [archivarPost] = useMutation(STAFF_ARCHIVAR_POST_MUTATION)
  const [eliminarPost] = useMutation(STAFF_ELIMINAR_POST_MUTATION)

  const handleSave = async () => {
    if (!titulo.trim()) { toast.error('El título es obligatorio'); return }
    setSaving(true)
    try {
      await actualizarPost({
        variables: { postId, titulo, contenido, extracto, imagenPortada, target },
      })
      toast.success('Cambios guardados')
    } catch { toast.error('Error al guardar') } finally { setSaving(false) }
  }

  const handlePublicar = async () => {
    setSaving(true)
    try {
      await publicarPost({ variables: { postId } })
      toast.success('Artículo publicado')
    } catch { toast.error('Error al publicar') } finally { setSaving(false) }
  }

  const handleArchivar = async () => {
    setSaving(true)
    try {
      await archivarPost({ variables: { postId } })
      toast.success('Artículo archivado')
    } catch { toast.error('Error al archivar') } finally { setSaving(false) }
  }

  const handleEliminar = async () => {
    try {
      await eliminarPost({ variables: { postId } })
      toast.success('Artículo eliminado')
      router.push('/blog')
    } catch { toast.error('Error al eliminar') }
  }

  if (loading) {
    return <div className="p-6 text-sm text-gray-400">Cargando...</div>
  }

  if (!post) {
    return <div className="p-6 text-sm text-red-500">Artículo no encontrado.</div>
  }

  const STATUS_LABEL: Record<string, string> = {
    draft: 'Borrador', published: 'Publicado', archived: 'Archivado',
  }
  const STATUS_CLS: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    published: 'bg-green-100 text-green-800',
    archived: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/blog')}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Editar artículo</h1>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_CLS[post.status] ?? ''}`}>
          {STATUS_LABEL[post.status] ?? post.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main editor */}
        <div className="lg:col-span-2 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Extracto</label>
            <textarea
              value={extracto}
              onChange={(e) => setExtracto(e.target.value)}
              maxLength={400}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Contenido <span className="text-gray-400 font-normal">(Markdown)</span>
              </label>
              <button
                onClick={() => setPreview(!preview)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                {preview ? <EyeOff size={13} /> : <Eye size={13} />}
                {preview ? 'Editar' : 'Vista previa'}
              </button>
            </div>

            {preview ? (
              <div className="min-h-64 border border-gray-200 rounded-lg px-4 py-3 bg-white prose prose-sm max-w-none text-gray-800">
                {contenido ? (
                  <ReactMarkdown>{contenido}</ReactMarkdown>
                ) : (
                  <p className="text-gray-400 italic">Sin contenido.</p>
                )}
              </div>
            ) : (
              <textarea
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
                rows={20}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Target */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
            <p className="text-sm font-medium text-gray-700 mb-3">Destino</p>
            {(['industry', 'business'] as const).map((t) => (
              <label
                key={t}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  target === t
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="target"
                  value={t}
                  checked={target === t}
                  onChange={() => setTarget(t)}
                  className="accent-blue-600"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    {t === 'industry' ? <Globe size={13} className="text-blue-500" /> : <Briefcase size={13} className="text-purple-500" />}
                    <span className="text-sm font-medium text-gray-800">
                      {t === 'industry' ? 'Industria' : 'Negocios'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {t === 'industry' ? 'Sitio público /blog' : 'Panel empresa /recursos'}
                  </p>
                </div>
              </label>
            ))}
          </div>

          {/* Image URL */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Imagen portada</label>
            <input
              type="url"
              value={imagenPortada}
              onChange={(e) => setImagenPortada(e.target.value)}
              placeholder="https://..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {imagenPortada && (
              <img
                src={imagenPortada}
                alt="preview"
                className="mt-2 w-full rounded-lg object-cover h-28"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
          </div>

          {/* Metadata */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500 space-y-1">
            <p>Autor: <span className="text-gray-700">{post.autorNombre}</span></p>
            <p>Slug: <span className="text-gray-700 font-mono">{post.slug}</span></p>
            {post.publishedAt && (
              <p>Publicado: <span className="text-gray-700">
                {new Date(post.publishedAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
              </span></p>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>

            {isAdmin && post.status === 'draft' && (
              <button
                onClick={handlePublicar}
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                Publicar
              </button>
            )}

            {isAdmin && post.status === 'published' && (
              <button
                onClick={handleArchivar}
                disabled={saving}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                Archivar
              </button>
            )}

            {isAdmin && (
              <>
                {showDeleteConfirm ? (
                  <div className="flex gap-2">
                    <button
                      onClick={handleEliminar}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
                    >
                      Confirmar eliminación
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center justify-center gap-2 w-full border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
                  >
                    <Trash2 size={13} />
                    Eliminar artículo
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
