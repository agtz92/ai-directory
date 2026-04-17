'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@apollo/client'
import { useStaffRole } from '@/lib/use-staff-role'
import { STAFF_CREAR_POST_MUTATION, STAFF_PUBLICAR_POST_MUTATION } from '@/lib/graphql/mutations'
import { Eye, EyeOff, ArrowLeft, Globe, Briefcase } from 'lucide-react'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'

export default function NewPostPage() {
  const router = useRouter()
  const { isAdmin } = useStaffRole()

  const [titulo, setTitulo] = useState('')
  const [target, setTarget] = useState<'industry' | 'business'>('industry')
  const [extracto, setExtracto] = useState('')
  const [imagenPortada, setImagenPortada] = useState('')
  const [contenido, setContenido] = useState('')
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)

  const [crearPost] = useMutation(STAFF_CREAR_POST_MUTATION)
  const [publicarPost] = useMutation(STAFF_PUBLICAR_POST_MUTATION)

  const save = async (publishAfter = false) => {
    if (!titulo.trim()) { toast.error('El título es obligatorio'); return }
    if (!contenido.trim()) { toast.error('El contenido es obligatorio'); return }
    setSaving(true)
    try {
      const { data } = await crearPost({
        variables: { titulo, contenido, extracto, imagenPortada, target },
      })
      const postId = data.staffCrearPost.id
      if (publishAfter && isAdmin) {
        await publicarPost({ variables: { postId } })
        toast.success('Artículo publicado')
      } else {
        toast.success('Borrador guardado')
      }
      router.push(`/blog/${postId}`)
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/blog')}
          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Nuevo artículo</h1>
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
              placeholder="Título del artículo"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Extracto</label>
            <textarea
              value={extracto}
              onChange={(e) => setExtracto(e.target.value)}
              placeholder="Breve descripción (máx. 400 caracteres)"
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
                  <p className="text-gray-400 italic">Sin contenido aún.</p>
                )}
              </div>
            ) : (
              <textarea
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
                placeholder="Escribe el artículo en Markdown..."
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

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={() => save(false)}
              disabled={saving}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar borrador'}
            </button>
            {isAdmin && (
              <button
                onClick={() => save(true)}
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Publicando...' : 'Publicar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
