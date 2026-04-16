'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation } from '@apollo/client'
import { STAFF_PRODUCTOS_QUERY, STAFF_EMPRESA_MODELOS_QUERY } from '@/lib/graphql/queries'
import {
  STAFF_CREAR_PRODUCTO_MUTATION,
  STAFF_ACTUALIZAR_PRODUCTO_MUTATION,
  STAFF_ELIMINAR_PRODUCTO_MUTATION,
  STAFF_ACTUALIZAR_EMPRESA_MODELO_MUTATION,
  STAFF_ELIMINAR_EMPRESA_MODELO_MUTATION,
} from '@/lib/graphql/mutations'
import { toast } from 'sonner'
import {
  ArrowLeft, Plus, Pencil, Trash2, Check, X, Loader2,
  Package, Tag, Box, Warehouse, ToggleLeft, ToggleRight,
} from 'lucide-react'
import Link from 'next/link'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Producto {
  id: string
  nombre: string
  descripcion: string
  precio: number | null
  unidad: string
  activo: boolean
  orden: number
  imagenUrl: string | null
  createdAt: string
}

interface ModeloVinculado {
  id: string
  existencia: boolean
  createdAt: string
  updatedAt: string
  modelo: {
    id: string
    nombre: string
    slug: string
    status: string
    marcaId: string
    marcaNombre: string
    subcategoriaId: string
    subcategoriaNombre: string
  }
}

const EMPTY_FORM = {
  nombre: '',
  descripcion: '',
  precio: '',
  unidad: '',
  activo: true,
  orden: 0,
}

// ─── Sección de modelos vinculados ────────────────────────────────────────────

function ModelosVinculados({ tenantId }: { tenantId: string }) {
  const { data, loading, refetch } = useQuery(STAFF_EMPRESA_MODELOS_QUERY, {
    variables: { tenantId },
    fetchPolicy: 'network-only',
  })

  const [actualizarEmpresaModelo] = useMutation(STAFF_ACTUALIZAR_EMPRESA_MODELO_MUTATION)
  const [eliminarEmpresaModelo] = useMutation(STAFF_ELIMINAR_EMPRESA_MODELO_MUTATION)

  const modelos: ModeloVinculado[] = data?.staffEmpresa?.modelosEmpresa ?? []

  const handleToggleExistencia = async (m: ModeloVinculado) => {
    try {
      await actualizarEmpresaModelo({
        variables: { empresaModeloId: m.id, existencia: !m.existencia },
      })
      refetch()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleDelete = async (m: ModeloVinculado) => {
    if (!confirm(`¿Quitar "${m.modelo.nombre}" del perfil del cliente?`)) return
    try {
      await eliminarEmpresaModelo({ variables: { empresaModeloId: m.id } })
      toast.success('Modelo eliminado del perfil')
      refetch()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 animate-pulse">
            <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  if (modelos.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
        <Box size={28} className="mx-auto mb-2 opacity-40" />
        <p className="text-sm">El cliente no ha vinculado ningún modelo todavía</p>
      </div>
    )
  }

  // Group by subcategory for readability
  const grouped = modelos.reduce<Record<string, ModeloVinculado[]>>((acc, m) => {
    const key = m.modelo.subcategoriaNombre
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([subcat, items]) => (
        <div key={subcat}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            {subcat}
          </p>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Modelo</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Marca</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Existencia</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Agregado</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{m.modelo.nombre}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                        <Tag size={10} />
                        {m.modelo.marcaNombre}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleExistencia(m)}
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium transition-colors cursor-pointer ${
                          m.existencia
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                        title="Click para cambiar existencia"
                      >
                        <Warehouse size={10} />
                        {m.existencia ? 'En existencia' : 'Sin existencia'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(m.createdAt).toLocaleDateString('es-MX', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(m)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Quitar del perfil"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function StaffProductosPage() {
  const { tenantId } = useParams<{ tenantId: string }>()

  const { data, loading, refetch } = useQuery(STAFF_PRODUCTOS_QUERY, {
    variables: { tenantId },
  })

  const [crearProducto]     = useMutation(STAFF_CREAR_PRODUCTO_MUTATION)
  const [actualizarProducto] = useMutation(STAFF_ACTUALIZAR_PRODUCTO_MUTATION)
  const [eliminarProducto]  = useMutation(STAFF_ELIMINAR_PRODUCTO_MUTATION)

  const [showForm, setShowForm]   = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [tab, setTab]             = useState<'modelos' | 'productos'>('modelos')

  const productos: Producto[] = data?.staffProductos ?? []

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (p: Producto) => {
    setEditingId(p.id)
    setForm({
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: p.precio != null ? String(p.precio) : '',
      unidad: p.unidad,
      activo: p.activo,
      orden: p.orden,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.nombre.trim()) { toast.error('El nombre es requerido'); return }
    setSaving(true)
    try {
      const precio = form.precio !== '' ? parseFloat(form.precio) : null
      if (editingId) {
        await actualizarProducto({
          variables: {
            productoId: editingId,
            nombre: form.nombre,
            descripcion: form.descripcion,
            precio,
            unidad: form.unidad,
            activo: form.activo,
            orden: form.orden,
          },
        })
        toast.success('Producto actualizado')
      } else {
        await crearProducto({
          variables: {
            tenantId,
            nombre: form.nombre,
            descripcion: form.descripcion,
            precio,
            unidad: form.unidad,
            activo: form.activo,
            orden: form.orden,
          },
        })
        toast.success('Producto creado')
      }
      setShowForm(false)
      setEditingId(null)
      refetch()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar "${nombre}"?`)) return
    try {
      await eliminarProducto({ variables: { productoId: id } })
      toast.success('Producto eliminado')
      refetch()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href={`/empresa/${tenantId}`} className="text-gray-400 hover:text-gray-700">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Catálogo del cliente</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        <button
          onClick={() => setTab('modelos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'modelos'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Box size={14} />
          Modelos vinculados
        </button>
        <button
          onClick={() => { setTab('productos'); setShowForm(false) }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'productos'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Package size={14} />
          Productos libres
          {!loading && productos.length > 0 && (
            <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
              {productos.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Tab: Modelos vinculados ── */}
      {tab === 'modelos' && (
        <div>
          <p className="text-xs text-gray-400 mb-4">
            Marcas y modelos que el cliente ha seleccionado para su perfil.
            Solo lectura — el cliente los gestiona desde su panel.
          </p>
          <ModelosVinculados tenantId={tenantId} />
        </div>
      )}

      {/* ── Tab: Productos libres ── */}
      {tab === 'productos' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-400">
              Productos o servicios de texto libre creados por staff.
            </p>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus size={15} />
              Nuevo producto
            </button>
          </div>

          {/* Form panel */}
          {showForm && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">
                {editingId ? 'Editar producto' : 'Nuevo producto'}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    placeholder="Ej. Válvulas industriales de acero"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                  <textarea
                    rows={3}
                    value={form.descripcion}
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                    placeholder="Descripción del producto o servicio..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Precio (opcional)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.precio}
                      onChange={(e) => setForm({ ...form, precio: e.target.value })}
                      placeholder="0.00"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Unidad</label>
                    <input
                      type="text"
                      value={form.unidad}
                      onChange={(e) => setForm({ ...form, unidad: e.target.value })}
                      placeholder="kg, ton, pieza, servicio..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Orden</label>
                    <input
                      type="number"
                      min="0"
                      value={form.orden}
                      onChange={(e) => setForm({ ...form, orden: parseInt(e.target.value) || 0 })}
                      className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer mt-4">
                    <input
                      type="checkbox"
                      checked={form.activo}
                      onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Activo (visible en el directorio)</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-5 pt-4 border-t border-gray-100">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X size={14} />
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Product list */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-blue-600" size={24} />
            </div>
          ) : productos.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
              <Package size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">Sin productos de texto libre</p>
              <button onClick={openCreate} className="mt-3 text-sm text-blue-600 hover:underline">
                Agregar el primero
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Producto</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Precio</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Estado</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {productos.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{p.nombre}</p>
                        {p.descripcion && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs" title={p.descripcion}>
                            {p.descripcion}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {p.precio != null
                          ? `$${Number(p.precio).toLocaleString('es-MX', { minimumFractionDigits: 2 })}${p.unidad ? ` / ${p.unidad}` : ''}`
                          : p.unidad
                            ? <span className="text-gray-400">{p.unidad}</span>
                            : <span className="text-gray-300">—</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {p.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(p)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id, p.nombre)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
