'use client'

import { useState } from 'react'
import { useQuery, useMutation, useLazyQuery, gql } from '@apollo/client'
import { toast } from 'sonner'
import {
  BookOpen, Tag, Box, Search, Plus, Pencil, Trash2, Check, Loader2,
  ChevronRight, CheckCircle2, XCircle, Clock,
} from 'lucide-react'
import { STAFF_MARCAS_QUERY, STAFF_MODELOS_QUERY } from '@/lib/graphql/queries'
import {
  STAFF_CREAR_MARCA_MUTATION, STAFF_ACTUALIZAR_MARCA_MUTATION, STAFF_ELIMINAR_MARCA_MUTATION,
  STAFF_CREAR_MODELO_MUTATION, STAFF_ACTUALIZAR_MODELO_MUTATION, STAFF_ELIMINAR_MODELO_MUTATION,
} from '@/lib/graphql/mutations'
import { useAuthStore } from '@/lib/auth-store'
import { useStaffRole } from '@/lib/use-staff-role'

// Types
interface Subcategoria {
  id: string
  nombre: string
  slug: string
  categoriaNombre?: string
}

interface Marca {
  id: string
  nombre: string
  slug: string
  descripcion: string
  activa: boolean
  status: string
  motivoRechazo: string
  orden: number
  createdAt: string
  subcategoriaId: string
  subcategoriaNombre: string
}

interface Modelo {
  id: string
  nombre: string
  slug: string
  descripcion: string
  activo: boolean
  status: string
  motivoRechazo: string
  orden: number
  createdAt: string
  marcaId: string
  marcaNombre: string
  subcategoriaId: string
  subcategoriaNombre: string
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'aprobada' || status === 'aprobado') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
        <CheckCircle2 size={9} /> Aprobado
      </span>
    )
  }
  if (status === 'rechazada' || status === 'rechazado') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">
        <XCircle size={9} /> Rechazado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
      <Clock size={9} /> Pendiente
    </span>
  )
}

// ─── Subcategoria picker ──────────────────────────────────────────────────────
// The staff schema doesn't have a subcategorias query.
// We call the main authenticated endpoint (NEXT_PUBLIC_GRAPHQL_URL) which does.

const SUBCATEGORIAS_SEARCH_PUBLIC = gql`
  query CatalogoSubcategoriasSearch($search: String!, $limit: Int) {
    subcategorias(search: $search, limit: $limit) {
      id nombre slug categoriaId categoriaNombre
    }
  }
`

function SubcategoriaSearch({
  onSelect,
}: {
  onSelect: (s: Subcategoria) => void
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const token = useAuthStore((s) => s.token)

  // Use the authenticated endpoint (not staff), which has subcategorias query
  const [search, { data, loading }] = useLazyQuery(SUBCATEGORIAS_SEARCH_PUBLIC, {
    context: {
      // Override endpoint to use the main graphql (not staff)
      uri: (process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:8000/graphql/'),
    },
    fetchPolicy: 'network-only',
  })

  const subcategorias: Subcategoria[] = data?.subcategorias ?? []

  const handleInput = (val: string) => {
    setQ(val)
    setOpen(true)
    if (val.trim().length >= 2) {
      search({ variables: { search: val.trim(), limit: 20 } })
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
        <input
          type="text"
          value={q}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Buscar subcategoría..."
          className="w-full pl-8 pr-3 py-2 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {loading && <Loader2 size={13} className="absolute right-3 top-2.5 animate-spin text-gray-400" />}
      </div>
      {open && q.length >= 2 && subcategorias.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
          {subcategorias.map((s) => (
            <button
              key={s.id}
              onClick={() => { onSelect(s); setQ(s.nombre); setOpen(false) }}
              className="flex items-center justify-between w-full px-3 py-2 hover:bg-blue-50 text-left"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{s.nombre}</p>
                <p className="text-xs text-gray-400">{s.categoriaNombre}</p>
              </div>
              <ChevronRight size={13} className="text-gray-300" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Marca row with inline edit ───────────────────────────────────────────────

function MarcaRow({
  marca,
  isSelected,
  onSelect,
  onDone,
  canDelete,
}: {
  marca: Marca
  isSelected: boolean
  onSelect: () => void
  onDone: () => void
  canDelete: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ nombre: marca.nombre, descripcion: marca.descripcion, status: marca.status })

  const [actualizar, { loading: saving }] = useMutation(STAFF_ACTUALIZAR_MARCA_MUTATION, {
    onCompleted: () => { toast.success('Marca actualizada'); setEditing(false); onDone() },
    onError: (e) => toast.error(e.message),
  })
  const [eliminar, { loading: deleting }] = useMutation(STAFF_ELIMINAR_MARCA_MUTATION, {
    onCompleted: () => { toast.success('Marca eliminada'); onDone() },
    onError: (e) => toast.error(e.message),
  })

  const handleSave = () => {
    actualizar({ variables: { marcaId: marca.id, nombre: form.nombre, descripcion: form.descripcion, status: form.status } })
  }

  const handleDelete = () => {
    if (!confirm(`¿Eliminar marca "${marca.nombre}" y todos sus modelos?`)) return
    eliminar({ variables: { marcaId: marca.id } })
  }

  if (editing) {
    return (
      <div className={`p-3 border-b border-gray-100 bg-blue-50`}>
        <div className="space-y-2">
          <input
            type="text"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            type="text"
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            placeholder="Descripción (opcional)"
            className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="pendiente">Pendiente</option>
            <option value="aprobada">Aprobada</option>
            <option value="rechazada">Rechazada</option>
          </select>
        </div>
        <div className="flex gap-2 mt-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded-lg disabled:opacity-50">
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Guardar
          </button>
          <button onClick={() => setEditing(false)}
            className="px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100">
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 border-b border-gray-100 cursor-pointer transition-colors ${
        isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-gray-50'
      }`}
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{marca.nombre}</p>
        <StatusBadge status={marca.status} />
      </div>
      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => setEditing(true)}
          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
          <Pencil size={12} />
        </button>
        {canDelete && (
          <button onClick={handleDelete} disabled={deleting}
            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50">
            <Trash2 size={12} />
          </button>
        )}
        <ChevronRight size={13} className={`transition-colors ${isSelected ? 'text-blue-500' : 'text-gray-300'}`} />
      </div>
    </div>
  )
}

// ─── Modelo row with inline edit ──────────────────────────────────────────────

function ModeloRow({
  modelo,
  onDone,
  canDelete,
}: {
  modelo: Modelo
  onDone: () => void
  canDelete: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ nombre: modelo.nombre, descripcion: modelo.descripcion, status: modelo.status })

  const [actualizar, { loading: saving }] = useMutation(STAFF_ACTUALIZAR_MODELO_MUTATION, {
    onCompleted: () => { toast.success('Modelo actualizado'); setEditing(false); onDone() },
    onError: (e) => toast.error(e.message),
  })
  const [eliminar, { loading: deleting }] = useMutation(STAFF_ELIMINAR_MODELO_MUTATION, {
    onCompleted: () => { toast.success('Modelo eliminado'); onDone() },
    onError: (e) => toast.error(e.message),
  })

  const handleSave = () => {
    actualizar({ variables: { modeloId: modelo.id, nombre: form.nombre, descripcion: form.descripcion, status: form.status } })
  }

  const handleDelete = () => {
    if (!confirm(`¿Eliminar modelo "${modelo.nombre}"?`)) return
    eliminar({ variables: { modeloId: modelo.id } })
  }

  if (editing) {
    return (
      <div className="p-3 border-b border-gray-100 bg-blue-50">
        <div className="space-y-2">
          <input type="text" value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input type="text" value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            placeholder="Descripción (opcional)"
            className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="pendiente">Pendiente</option>
            <option value="aprobado">Aprobado</option>
            <option value="rechazado">Rechazado</option>
          </select>
        </div>
        <div className="flex gap-2 mt-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded-lg disabled:opacity-50">
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Guardar
          </button>
          <button onClick={() => setEditing(false)}
            className="px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100">
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{modelo.nombre}</p>
        {modelo.descripcion && (
          <p className="text-xs text-gray-400 truncate">{modelo.descripcion}</p>
        )}
        <StatusBadge status={modelo.status} />
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => setEditing(true)}
          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
          <Pencil size={12} />
        </button>
        {canDelete && (
          <button onClick={handleDelete} disabled={deleting}
            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50">
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CatalogoPage() {
  const { isAdmin } = useStaffRole()
  const token = useAuthStore((s) => s.token)

  const [selectedSub, setSelectedSub] = useState<Subcategoria | null>(null)
  const [selectedMarca, setSelectedMarca] = useState<Marca | null>(null)

  // New marca form
  const [showMarcaForm, setShowMarcaForm] = useState(false)
  const [newMarcaNombre, setNewMarcaNombre] = useState('')
  const [newMarcaDesc, setNewMarcaDesc] = useState('')

  // New modelo form
  const [showModeloForm, setShowModeloForm] = useState(false)
  const [newModeloNombre, setNewModeloNombre] = useState('')
  const [newModeloDesc, setNewModeloDesc] = useState('')

  const { data: marcaData, loading: marcaLoading, refetch: refetchMarcas } = useQuery(STAFF_MARCAS_QUERY, {
    variables: { subcategoriaId: selectedSub?.id ?? '', status: '' },
    skip: !selectedSub,
    fetchPolicy: 'network-only',
  })

  const { data: modeloData, loading: modeloLoading, refetch: refetchModelos } = useQuery(STAFF_MODELOS_QUERY, {
    variables: { marcaId: selectedMarca?.id ?? '', status: '' },
    skip: !selectedMarca,
    fetchPolicy: 'network-only',
  })

  const [crearMarca, { loading: creatingMarca }] = useMutation(STAFF_CREAR_MARCA_MUTATION, {
    onCompleted: () => {
      toast.success('Marca creada')
      setShowMarcaForm(false); setNewMarcaNombre(''); setNewMarcaDesc('')
      refetchMarcas()
    },
    onError: (e) => toast.error(e.message),
  })

  const [crearModelo, { loading: creatingModelo }] = useMutation(STAFF_CREAR_MODELO_MUTATION, {
    onCompleted: () => {
      toast.success('Modelo creado')
      setShowModeloForm(false); setNewModeloNombre(''); setNewModeloDesc('')
      refetchModelos()
    },
    onError: (e) => toast.error(e.message),
  })

  const marcas: Marca[] = marcaData?.staffMarcas ?? []
  const modelos: Modelo[] = modeloData?.staffModelos ?? []

  const handleSubSelect = (sub: Subcategoria) => {
    setSelectedSub(sub)
    setSelectedMarca(null)
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <BookOpen size={18} className="text-blue-500" />
          Catálogo global
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          Gestiona subcategorías → marcas → modelos. Las marcas y modelos creados aquí se aprueban automáticamente.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 h-[calc(100vh-160px)]">

        {/* ── Columna 1: Subcategoría ── */}
        <div className="bg-white border border-gray-200 rounded-2xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Tag size={12} /> Subcategoría
            </p>
          </div>
          <div className="p-3">
            <SubcategoriaSearch onSelect={handleSubSelect} />
          </div>
          {selectedSub && (
            <div className="mx-3 mb-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-xs text-blue-600 font-medium">Seleccionada</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">{selectedSub.nombre}</p>
              {selectedSub.categoriaNombre && (
                <p className="text-xs text-gray-400">{selectedSub.categoriaNombre}</p>
              )}
            </div>
          )}
          {!selectedSub && (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm p-4 text-center">
              Busca una subcategoría para ver sus marcas
            </div>
          )}
        </div>

        {/* ── Columna 2: Marcas ── */}
        <div className="bg-white border border-gray-200 rounded-2xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Tag size={12} /> Marcas
              {marcas.length > 0 && (
                <span className="bg-gray-200 text-gray-600 text-[10px] px-1.5 rounded-full font-bold">
                  {marcas.length}
                </span>
              )}
            </p>
            {selectedSub && (
              <button
                onClick={() => setShowMarcaForm(!showMarcaForm)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                <Plus size={12} />
                Nueva
              </button>
            )}
          </div>

          {/* New marca form */}
          {showMarcaForm && selectedSub && (
            <div className="p-3 border-b border-gray-100 bg-blue-50">
              <input
                type="text"
                value={newMarcaNombre}
                onChange={(e) => setNewMarcaNombre(e.target.value)}
                placeholder="Nombre de la marca *"
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
              <input
                type="text"
                value={newMarcaDesc}
                onChange={(e) => setNewMarcaDesc(e.target.value)}
                placeholder="Descripción (opcional)"
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs mb-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => crearMarca({ variables: { subcategoriaId: selectedSub.id, nombre: newMarcaNombre, descripcion: newMarcaDesc || undefined } })}
                  disabled={!newMarcaNombre.trim() || creatingMarca}
                  className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded-lg disabled:opacity-50"
                >
                  {creatingMarca ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                  Crear
                </button>
                <button onClick={() => setShowMarcaForm(false)}
                  className="px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {!selectedSub ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm p-4 text-center">
                Selecciona una subcategoría
              </div>
            ) : marcaLoading ? (
              <div className="flex justify-center items-center h-20">
                <Loader2 className="animate-spin text-blue-500" size={20} />
              </div>
            ) : marcas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 py-8">
                <Tag size={24} className="mb-2 opacity-40" />
                <p className="text-sm">Sin marcas</p>
                <p className="text-xs mt-1">Crea la primera con el botón "Nueva"</p>
              </div>
            ) : (
              marcas.map((m) => (
                <MarcaRow
                  key={m.id}
                  marca={m}
                  isSelected={selectedMarca?.id === m.id}
                  onSelect={() => setSelectedMarca(m)}
                  onDone={() => refetchMarcas()}
                  canDelete={isAdmin}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Columna 3: Modelos ── */}
        <div className="bg-white border border-gray-200 rounded-2xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Box size={12} /> Modelos
              {modelos.length > 0 && (
                <span className="bg-gray-200 text-gray-600 text-[10px] px-1.5 rounded-full font-bold">
                  {modelos.length}
                </span>
              )}
            </p>
            {selectedMarca && (
              <button
                onClick={() => setShowModeloForm(!showModeloForm)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                <Plus size={12} />
                Nuevo
              </button>
            )}
          </div>

          {/* New modelo form */}
          {showModeloForm && selectedMarca && (
            <div className="p-3 border-b border-gray-100 bg-blue-50">
              <p className="text-xs text-gray-500 mb-2">
                Marca: <span className="font-medium text-gray-800">{selectedMarca.nombre}</span>
              </p>
              <input
                type="text"
                value={newModeloNombre}
                onChange={(e) => setNewModeloNombre(e.target.value)}
                placeholder="Nombre del modelo *"
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
              <input
                type="text"
                value={newModeloDesc}
                onChange={(e) => setNewModeloDesc(e.target.value)}
                placeholder="Descripción (opcional)"
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs mb-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => crearModelo({ variables: { marcaId: selectedMarca.id, nombre: newModeloNombre, descripcion: newModeloDesc || undefined } })}
                  disabled={!newModeloNombre.trim() || creatingModelo}
                  className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded-lg disabled:opacity-50"
                >
                  {creatingModelo ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                  Crear
                </button>
                <button onClick={() => setShowModeloForm(false)}
                  className="px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {!selectedMarca ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm p-4 text-center">
                Selecciona una marca
              </div>
            ) : modeloLoading ? (
              <div className="flex justify-center items-center h-20">
                <Loader2 className="animate-spin text-blue-500" size={20} />
              </div>
            ) : modelos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 py-8">
                <Box size={24} className="mb-2 opacity-40" />
                <p className="text-sm">Sin modelos</p>
                <p className="text-xs mt-1">Crea el primero con el botón "Nuevo"</p>
              </div>
            ) : (
              modelos.map((m) => (
                <ModeloRow
                  key={m.id}
                  modelo={m}
                  onDone={() => refetchModelos()}
                  canDelete={isAdmin}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
