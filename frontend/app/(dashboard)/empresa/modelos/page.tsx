'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useLazyQuery } from '@apollo/client'
import { toast } from 'sonner'
import {
  Check, Loader2, Plus, X, Tag, Box,
  CheckCircle2, Clock, XCircle, ChevronDown, ChevronRight, Info, Trash2, AlertTriangle,
} from 'lucide-react'
import {
  MI_EMPRESA_QUERY,
  MI_EMPRESA_CON_MODELOS_QUERY,
  MARCAS_QUERY,
  MODELOS_QUERY,
  MIS_MARCAS_PROPUESTAS_QUERY,
  MIS_MODELOS_PROPUESTOS_QUERY,
  SUBCATEGORIAS_SEARCH_QUERY,
} from '@/lib/graphql/queries'
import {
  AGREGAR_EMPRESA_MODELO_MUTATION,
  ACTUALIZAR_EMPRESA_MODELO_MUTATION,
  ELIMINAR_EMPRESA_MODELO_MUTATION,
  SOLICITAR_MARCA_MUTATION,
  SOLICITAR_MODELO_MUTATION,
  ACTUALIZAR_EMPRESA_MUTATION,
} from '@/lib/graphql/mutations'
import { useAuthStore } from '@/lib/auth-store'
import { useDebounce } from '@/lib/use-debounce'
import { usePlan, UNLIMITED } from '@/lib/use-plan'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Subcategoria { id: string; nombre: string; slug: string }
interface Marca        { id: string; nombre: string; slug: string; status: string }
interface Modelo       { id: string; nombre: string; slug: string; status: string; marcaId: string | null; marcaNombre: string | null }

interface ExistingEM {
  id: string
  subcategoriaId: string
  subcategoriaNombre: string
  marcaId: string | null
  marcaNombre: string | null
  marcaStatus: string | null
  modeloId: string | null
  modeloNombre: string | null
  modeloStatus: string | null
  existencia: boolean
}

interface PendingItem {
  modeloId: string
  subcategoriaId: string
  marcaId: string | null
  nombre: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emKey(subcategoriaId: string, marcaId: string | null, modeloId: string | null) {
  return `${subcategoriaId}|${marcaId ?? ''}|${modeloId ?? ''}`
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'aprobada' || status === 'aprobado') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
        <CheckCircle2 size={10} /> Aprobado
      </span>
    )
  }
  if (status === 'rechazada' || status === 'rechazado') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
        <XCircle size={10} /> Rechazado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
      <Clock size={10} /> En revisión
    </span>
  )
}

// ─── Existencia toggle ────────────────────────────────────────────────────────

function ExistenciaToggle({ em }: { em: ExistingEM }) {
  const [actualizar, { loading }] = useMutation(ACTUALIZAR_EMPRESA_MODELO_MUTATION, {
    refetchQueries: [MI_EMPRESA_CON_MODELOS_QUERY],
  })

  return (
    <button
      onClick={() => actualizar({ variables: { empresaModeloId: em.id, existencia: !em.existencia } }).catch((e) => toast.error(e.message))}
      disabled={loading}
      className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none disabled:opacity-50"
      style={{ backgroundColor: em.existencia ? '#16a34a' : '#d1d5db' }}
    >
      <span
        className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
        style={{ transform: em.existencia ? 'translateX(24px)' : 'translateX(2px)' }}
      />
      {loading && <Loader2 size={8} className="absolute inset-0 m-auto animate-spin text-white" />}
    </button>
  )
}

// ─── Eliminar button ──────────────────────────────────────────────────────────

function EliminarButton({ em }: { em: ExistingEM }) {
  const [eliminar, { loading }] = useMutation(ELIMINAR_EMPRESA_MODELO_MUTATION, {
    refetchQueries: [MI_EMPRESA_CON_MODELOS_QUERY],
  })

  return (
    <button
      onClick={() => eliminar({ variables: { empresaModeloId: em.id } }).catch((e) => toast.error(e.message))}
      disabled={loading}
      className="p-1.5 text-gray-300 hover:text-red-400 transition-colors disabled:opacity-40"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
    </button>
  )
}

// ─── Agregar button (one-click add) ──────────────────────────────────────────

function AgregarButton({
  subcategoriaId, marcaId, modeloId, label = 'Agregar',
}: {
  subcategoriaId: string
  marcaId: string | null
  modeloId: string | null
  label?: string
}) {
  const [agregar, { loading }] = useMutation(AGREGAR_EMPRESA_MODELO_MUTATION, {
    refetchQueries: [MI_EMPRESA_CON_MODELOS_QUERY],
  })

  const handleClick = async () => {
    try {
      await agregar({ variables: { subcategoriaId, marcaId, modeloId, existencia: true } })
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors disabled:opacity-40 shrink-0"
    >
      {loading ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
      {label}
    </button>
  )
}

// ─── Brand chip ───────────────────────────────────────────────────────────────

function MarcaChip({ nombre }: { nombre: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
      <Tag size={10} />
      {nombre}
    </span>
  )
}

// ─── Inline agregar modelo ────────────────────────────────────────────────────

function InlineAgregarModelo({
  subcategoriaId, marcaId, onSolicited,
}: {
  subcategoriaId: string
  marcaId: string | null
  onSolicited?: (item: PendingItem) => void
}) {
  const [open, setOpen] = useState(false)
  const [nombre, setNombre] = useState('')
  const [solicitar, { loading }] = useMutation(SOLICITAR_MODELO_MUTATION, {
    refetchQueries: [MI_EMPRESA_CON_MODELOS_QUERY],
  })

  const handleSubmit = async () => {
    if (!nombre.trim()) return
    const trimmed = nombre.trim()
    try {
      let result = (await solicitar({
        variables: { subcategoriaId, marcaId, nombre: trimmed, confirmarDuplicado: false },
      })).data?.solicitarModelo

      if (result?.similares?.length > 0 && !result?.modelo) {
        result = (await solicitar({
          variables: { subcategoriaId, marcaId, nombre: trimmed, confirmarDuplicado: true },
        })).data?.solicitarModelo
      }

      toast.success(`"${trimmed}" enviado para aprobación.`)
      if (result?.modelo) {
        onSolicited?.({ modeloId: result.modelo.id, subcategoriaId, marcaId, nombre: result.modelo.nombre })
      }
      setNombre('')
      setOpen(false)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 mt-1 px-1 py-0.5 transition-colors"
      >
        <Plus size={11} /> Agregar modelo
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <input
        autoFocus
        type="text"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') setOpen(false) }}
        placeholder="Nombre del modelo..."
        className="flex-1 border border-blue-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <button
        onClick={handleSubmit}
        disabled={loading || !nombre.trim()}
        className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg disabled:opacity-40 transition-colors"
      >
        {loading ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
        Enviar
      </button>
      <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
        <X size={14} />
      </button>
    </div>
  )
}

// ─── Inline agregar marca ─────────────────────────────────────────────────────

function InlineAgregarMarca({ subcategoriaId }: { subcategoriaId: string }) {
  const [open, setOpen] = useState(false)
  const [nombre, setNombre] = useState('')
  const [solicitar, { loading }] = useMutation(SOLICITAR_MARCA_MUTATION, {
    refetchQueries: [MI_EMPRESA_CON_MODELOS_QUERY],
  })

  const handleSubmit = async () => {
    if (!nombre.trim()) return
    try {
      await solicitar({ variables: { subcategoriaId, nombre: nombre.trim() } })
      toast.success(`Marca "${nombre.trim()}" enviada para aprobación.`)
      setNombre('')
      setOpen(false)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 transition-colors"
      >
        <Plus size={13} /> Agregar marca
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        type="text"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') setOpen(false) }}
        placeholder="Nombre de la marca..."
        className="flex-1 border border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <button
        onClick={handleSubmit}
        disabled={loading || !nombre.trim()}
        className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-40 transition-colors"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
        Enviar
      </button>
      <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
        <X size={16} />
      </button>
    </div>
  )
}

// ─── Fila de modelo ───────────────────────────────────────────────────────────

function ModeloRow({
  nombre, existing, subcategoriaId, marcaId, modeloId, isPending,
}: {
  nombre: string
  existing: ExistingEM | undefined
  subcategoriaId: string
  marcaId: string | null
  modeloId: string
  isPending: boolean
}) {
  if (isPending) {
    return (
      <div className="flex items-center gap-3 px-5 py-2.5 bg-amber-50">
        <Clock size={13} className="text-amber-400 shrink-0" />
        <span className="text-sm flex-1 text-gray-500 italic">{nombre}</span>
        <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">
          <Clock size={9} /> En aprobación
        </span>
      </div>
    )
  }

  if (existing) {
    const effectiveStatus = existing.modeloStatus ?? existing.marcaStatus
    const isPendingStatus = effectiveStatus === 'pendiente'
    const isRejected = effectiveStatus === 'rechazada' || effectiveStatus === 'rechazado'

    if (isPendingStatus || isRejected) {
      return (
        <div className="flex items-center gap-3 px-5 py-2.5">
          <span className="text-sm flex-1 text-gray-400">{nombre}</span>
          {isPendingStatus && (
            <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">
              <Clock size={9} /> En espera
            </span>
          )}
          {isRejected && (
            <span className="inline-flex items-center gap-1 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium shrink-0">
              <XCircle size={9} /> Rechazado
            </span>
          )}
        </div>
      )
    }

    return (
      <div className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors">
        <span className="text-sm flex-1 text-gray-700">{nombre}</span>
        <ExistenciaToggle em={existing} />
        <EliminarButton em={existing} />
      </div>
    )
  }

  // Not in catalog
  return (
    <div className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors">
      <span className="text-sm flex-1 text-gray-500">{nombre}</span>
      <AgregarButton subcategoriaId={subcategoriaId} marcaId={marcaId} modeloId={modeloId} />
    </div>
  )
}

// ─── Sección de una marca ─────────────────────────────────────────────────────

function MarcaSection({
  marca, modelos, subcategoria, existingMap, pendingItems, onSolicited, extraExistingItems,
}: {
  marca: Marca
  modelos: Modelo[]
  subcategoria: Subcategoria
  existingMap: Map<string, ExistingEM>
  pendingItems: PendingItem[]
  onSolicited: (item: PendingItem) => void
  extraExistingItems: ExistingEM[]
}) {
  const [expanded, setExpanded] = useState(true)
  const marcaOnlyKey = emKey(subcategoria.id, marca.id, null)
  const marcaExisting = existingMap.get(marcaOnlyKey)
  const catalogModelIds = new Set(modelos.map((m) => m.id))

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Brand header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center gap-2 text-left"
        >
          <Tag size={14} className="text-amber-500 shrink-0" />
          <span className="text-sm font-semibold text-gray-800">{marca.nombre}</span>
          {expanded
            ? <ChevronDown size={13} className="text-gray-400 ml-auto" />
            : <ChevronRight size={13} className="text-gray-400 ml-auto" />
          }
        </button>

        {/* "Solo marca" area */}
        <div className="flex items-center gap-1.5 shrink-0 border-l border-gray-200 pl-3">
          {marcaExisting ? (
            <>
              <span className="text-xs text-gray-400">Solo marca</span>
              <ExistenciaToggle em={marcaExisting} />
              <EliminarButton em={marcaExisting} />
            </>
          ) : (
            <AgregarButton
              subcategoriaId={subcategoria.id}
              marcaId={marca.id}
              modeloId={null}
              label="Solo marca"
            />
          )}
        </div>
      </div>

      {/* Models list */}
      {expanded && (
        <div className="divide-y divide-gray-50">
          {modelos.map((modelo) => {
            const key = emKey(subcategoria.id, marca.id, modelo.id)
            return (
              <ModeloRow
                key={modelo.id}
                nombre={modelo.nombre}
                existing={existingMap.get(key)}
                subcategoriaId={subcategoria.id}
                marcaId={marca.id}
                modeloId={modelo.id}
                isPending={false}
              />
            )
          })}

          {/* Extra existing items (linked to this brand but model has different native brand) */}
          {extraExistingItems
            .filter((em) => em.modeloId && !catalogModelIds.has(em.modeloId))
            .map((em) => (
              <div key={em.modeloId} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors">
                <span className="text-sm flex-1 text-gray-700">{em.modeloNombre}</span>
                <ExistenciaToggle em={em} />
                <EliminarButton em={em} />
              </div>
            ))
          }

          {/* Pending (just submitted) items */}
          {pendingItems.map((p) => (
            <div key={p.modeloId} className="flex items-center gap-3 px-5 py-2.5 bg-amber-50">
              <Clock size={13} className="text-amber-400 shrink-0" />
              <span className="text-sm flex-1 text-gray-500 italic">{p.nombre}</span>
              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                <Clock size={9} /> En aprobación
              </span>
            </div>
          ))}

          <div className="px-5 py-2.5">
            <InlineAgregarModelo
              subcategoriaId={subcategoria.id}
              marcaId={marca.id}
              onSolicited={onSolicited}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sección sin marca ────────────────────────────────────────────────────────

function GenericSection({
  modelos, subcategoria, existingMap, pendingItems, onSolicited,
}: {
  modelos: Modelo[]
  subcategoria: Subcategoria
  existingMap: Map<string, ExistingEM>
  pendingItems: PendingItem[]
  onSolicited: (item: PendingItem) => void
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-100"
      >
        <div className="flex items-center gap-2">
          <Box size={14} className="text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">Sin marca — genéricos</span>
        </div>
        {expanded
          ? <ChevronDown size={13} className="text-gray-400" />
          : <ChevronRight size={13} className="text-gray-400" />
        }
      </button>

      {expanded && (
        <div className="divide-y divide-gray-50">
          {modelos.map((modelo) => {
            const key = emKey(subcategoria.id, null, modelo.id)
            return (
              <ModeloRow
                key={modelo.id}
                nombre={modelo.nombre}
                existing={existingMap.get(key)}
                subcategoriaId={subcategoria.id}
                marcaId={null}
                modeloId={modelo.id}
                isPending={false}
              />
            )
          })}

          {pendingItems.map((p) => (
            <div key={p.modeloId} className="flex items-center gap-3 px-5 py-2.5 bg-amber-50">
              <Clock size={13} className="text-amber-400 shrink-0" />
              <span className="text-sm flex-1 text-gray-500 italic">{p.nombre}</span>
              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                <Clock size={9} /> En aprobación
              </span>
            </div>
          ))}

          <div className="px-5 py-2.5">
            <InlineAgregarModelo
              subcategoriaId={subcategoria.id}
              marcaId={null}
              onSolicited={onSolicited}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Mis productos ───────────────────────────────────────────────────────

interface SubItem {
  id: string
  nombre: string
  slug: string
  categoriaId: string
  categoriaNombre: string
}

const INPUT_CLS = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

function TabProductos() {
  const token = useAuthStore((s) => s.token)
  const { limits } = usePlan()
  const maxSubcategorias = limits.maxSubcategorias

  const [subSearch, setSubSearch] = useState('')
  const [subOpen, setSubOpen] = useState(false)
  const [subHighlight, setSubHighlight] = useState(-1)
  const subRef = useRef<HTMLDivElement>(null)

  const [confirmedSubs, setConfirmedSubs] = useState<SubItem[]>([])
  const [pendingAdd, setPendingAdd] = useState<Set<string>>(new Set())
  const [pendingRemove, setPendingRemove] = useState<Set<string>>(new Set())
  const [subCache, setSubCache] = useState<Map<string, SubItem>>(new Map())

  const { data } = useQuery(MI_EMPRESA_QUERY, {
    fetchPolicy: 'cache-and-network',
    skip: !token,
  })

  const [toggleSub] = useMutation(ACTUALIZAR_EMPRESA_MUTATION)

  const [searchSubs, { data: searchData, loading: searchLoading }] = useLazyQuery(SUBCATEGORIAS_SEARCH_QUERY, {
    fetchPolicy: 'cache-first',
  })
  const debouncedSearch = useDebounce(subSearch, 300)

  const empresa = data?.miEmpresa

  useEffect(() => {
    const subs = empresa?.subcategorias as SubItem[] | undefined
    if (!subs) return
    setConfirmedSubs(subs)
    setPendingAdd(new Set())
    setPendingRemove(new Set())
    setSubCache(prev => {
      const next = new Map(prev)
      subs.forEach(s => next.set(s.id, s))
      return next
    })
  }, [empresa?.subcategorias])

  useEffect(() => {
    const results = searchData?.subcategorias as SubItem[] | undefined
    if (!results?.length) return
    setSubCache(prev => {
      const next = new Map(prev)
      results.forEach(s => next.set(s.id, s))
      return next
    })
  }, [searchData])

  useEffect(() => {
    const trimmed = debouncedSearch.trim()
    if (trimmed.length < 2) return
    searchSubs({ variables: { search: trimmed, limit: 20 } })
  }, [debouncedSearch])

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (subRef.current && !subRef.current.contains(e.target as Node)) {
        setSubOpen(false)
        setSubHighlight(-1)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  const displayedSubs = useMemo<SubItem[]>(() => {
    const base = confirmedSubs.filter(s => !pendingRemove.has(s.id))
    const added = [...pendingAdd]
      .map(id => subCache.get(id))
      .filter((s): s is SubItem => Boolean(s))
    return [...base, ...added]
  }, [confirmedSubs, pendingAdd, pendingRemove, subCache])

  const displayedIds = useMemo(() => new Set(displayedSubs.map(s => s.id)), [displayedSubs])

  const searchResults: SubItem[] = (searchData?.subcategorias ?? []) as SubItem[]
  const availableSubs = useMemo<SubItem[]>(
    () => searchResults.filter(s => !displayedIds.has(s.id)),
    [searchResults, displayedIds]
  )

  const derivedCats = useMemo<string[]>(
    () => [...new Set(displayedSubs.map(s => s.categoriaNombre).filter(Boolean))],
    [displayedSubs]
  )

  const isOverLimit = (
    empresa != null &&
    maxSubcategorias < UNLIMITED &&
    displayedSubs.length > maxSubcategorias
  )
  const exceso = isOverLimit ? displayedSubs.length - maxSubcategorias : 0

  async function handleToggleSub(sub: SubItem) {
    if (pendingAdd.has(sub.id) || pendingRemove.has(sub.id)) return
    const isSelected = displayedIds.has(sub.id)

    if (!isSelected && displayedSubs.length >= maxSubcategorias) {
      toast.error(`Tu plan permite hasta ${maxSubcategorias} productos/servicios.`)
      return
    }

    if (isSelected) {
      setPendingRemove(prev => new Set([...prev, sub.id]))
    } else {
      setSubCache(prev => { const n = new Map(prev); n.set(sub.id, sub); return n })
      setPendingAdd(prev => new Set([...prev, sub.id]))
    }
    setSubSearch('')
    setSubOpen(false)
    setSubHighlight(-1)

    const confirmedIds = confirmedSubs.map(s => s.id)
    const newIds = isSelected
      ? confirmedIds.filter(id => id !== sub.id)
      : [...confirmedIds, sub.id]

    try {
      await toggleSub({ variables: { subcategoriaIds: newIds } })
    } catch (err: any) {
      if (isSelected) {
        setPendingRemove(prev => { const n = new Set(prev); n.delete(sub.id); return n })
      } else {
        setPendingAdd(prev => { const n = new Set(prev); n.delete(sub.id); return n })
      }
      toast.error(err?.graphQLErrors?.[0]?.message ?? err?.message ?? 'Error al actualizar')
    }
  }

  return (
    <div className="space-y-6">
      {isOverLimit ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>
            Debes eliminar <strong>{exceso} producto{exceso !== 1 ? 's' : ''}</strong> para
            quedar dentro del límite de tu plan ({maxSubcategorias} máximo).
          </span>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          Agrega los productos o servicios que ofrece tu empresa. Las categorías se asignan automáticamente.
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Productos / Servicios</label>

        {displayedSubs.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {displayedSubs.map((s) => (
              <span
                key={s.id}
                title={s.categoriaNombre}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-opacity ${
                  pendingAdd.has(s.id) || pendingRemove.has(s.id)
                    ? 'opacity-60 bg-blue-50 border-blue-200 text-blue-500'
                    : 'bg-blue-100 border-blue-300 text-blue-700'
                }`}
              >
                {s.nombre}
                <button
                  type="button"
                  onClick={() => handleToggleSub(s)}
                  className="ml-0.5 hover:text-blue-900"
                  disabled={pendingAdd.has(s.id) || pendingRemove.has(s.id)}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div ref={subRef} className="relative">
          <input
            type="text"
            value={subSearch}
            placeholder={displayedSubs.length >= maxSubcategorias
              ? `Límite de ${maxSubcategorias} alcanzado`
              : 'Buscar producto o servicio...'}
            disabled={displayedSubs.length >= maxSubcategorias}
            onFocus={() => { setSubOpen(true); setSubHighlight(-1) }}
            onChange={(e) => { setSubSearch(e.target.value); setSubHighlight(-1) }}
            onKeyDown={(e) => {
              if (!subOpen) return
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSubHighlight(h => Math.min(h + 1, availableSubs.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSubHighlight(h => Math.max(h - 1, -1))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                if (availableSubs[subHighlight]) handleToggleSub(availableSubs[subHighlight])
              } else if (e.key === 'Escape') {
                setSubOpen(false)
                setSubHighlight(-1)
              }
            }}
            className={INPUT_CLS}
            autoComplete="off"
          />
          {subOpen && subSearch.trim().length >= 2 && (
            <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
              {availableSubs.map((s, i) => (
                <li
                  key={s.id}
                  onClick={() => handleToggleSub(s)}
                  className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between ${
                    i === subHighlight ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span>{s.nombre}</span>
                  <span className="text-xs text-gray-400 ml-2 shrink-0">{s.categoriaNombre}</span>
                </li>
              ))}
              {searchLoading && (
                <li className="px-3 py-2 text-sm text-gray-400 flex items-center gap-2">
                  <span className="inline-block w-3 h-3 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                  Buscando...
                </li>
              )}
              {!searchLoading && availableSubs.length === 0 && (
                <li className="px-3 py-2 text-sm text-gray-400">Sin resultados</li>
              )}
              {!searchLoading && searchResults.length >= 20 && (
                <li className="px-3 py-2 text-xs text-gray-400 border-t border-gray-100">
                  Sigue tecleando para ver más opciones
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      {derivedCats.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Categorías asignadas automáticamente</p>
          <div className="flex flex-wrap gap-2">
            {derivedCats.map((nombre) => (
              <span
                key={nombre}
                className="px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-600 border border-gray-200"
              >
                {nombre}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Mis solicitudes ─────────────────────────────────────────────────────

function TabSolicitudes() {
  const token = useAuthStore((s) => s.token)

  const { data: marcasData, loading: marcasLoading } = useQuery(MIS_MARCAS_PROPUESTAS_QUERY, {
    fetchPolicy: 'cache-and-network',
    skip: !token,
  })
  const { data: modelosData, loading: modelosLoading } = useQuery(MIS_MODELOS_PROPUESTOS_QUERY, {
    fetchPolicy: 'cache-and-network',
    skip: !token,
  })

  const marcas = marcasData?.misMarcasPropuestas ?? []
  const modelos = modelosData?.misModelosPropuestos ?? []
  const loading = marcasLoading || modelosLoading

  if (loading && marcas.length === 0 && modelos.length === 0) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-500" size={22} /></div>
  }

  if (marcas.length === 0 && modelos.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
        <Clock size={32} className="mx-auto mb-3 text-gray-300" />
        <p className="text-sm text-gray-500 font-medium">Sin solicitudes aún</p>
        <p className="text-xs text-gray-400 mt-1">Cuando agregues una marca o modelo nuevo, verás su estado aquí</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {marcas.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Marcas ({marcas.length})
          </p>
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Marca</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Subcategoría</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Enviada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {marcas.map((m: any) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{m.nombre}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{m.subcategoriaNombre}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={m.status} />
                      {(m.status === 'rechazada' || m.status === 'rechazado') && m.motivoRechazo && (
                        <p className="text-xs text-red-500 mt-0.5">{m.motivoRechazo}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(m.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modelos.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Modelos ({modelos.length})
          </p>
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Modelo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Marca</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Enviado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {modelos.map((m: any) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{m.nombre}</td>
                    <td className="px-4 py-3">
                      {m.marcaNombre
                        ? <MarcaChip nombre={m.marcaNombre} />
                        : <span className="text-gray-400 italic text-xs">Sin marca</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={m.status} />
                      {(m.status === 'rechazada' || m.status === 'rechazado') && m.motivoRechazo && (
                        <p className="text-xs text-red-500 mt-0.5">{m.motivoRechazo}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(m.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

type ActiveTab = 'mis-modelos' | 'mis-solicitudes' | 'mis-productos'

export default function ModelosPage() {
  const token = useAuthStore((s) => s.token)
  const [activeTab, setActiveTab] = useState<ActiveTab>('mis-modelos')
  const [selectedSub, setSelectedSub] = useState<Subcategoria | null>(null)
  const [localPending, setLocalPending] = useState<PendingItem[]>([])

  // ── Subcategoria dropdown state ───────────────────────────────────────────
  const [subSearch, setSubSearch] = useState('')
  const [subOpen, setSubOpen] = useState(false)
  const [subHighlight, setSubHighlight] = useState(-1)
  const subDropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (subDropRef.current && !subDropRef.current.contains(e.target as Node)) {
        setSubOpen(false)
        setSubHighlight(-1)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  // ── Data ─────────────────────────────────────────────────────────────────────

  const { data: empresaData } = useQuery(MI_EMPRESA_QUERY, {
    fetchPolicy: 'cache-first',
    skip: !token,
  })
  const empresaSubs: Subcategoria[] = empresaData?.miEmpresa?.subcategorias ?? []

  const { data: misModelosData, loading: misModelosLoading } = useQuery(MI_EMPRESA_CON_MODELOS_QUERY, {
    fetchPolicy: 'cache-and-network',
    skip: !token,
  })
  const misModelos: ExistingEM[] = misModelosData?.miEmpresa?.modelosEmpresa ?? []

  const existingMap = new Map<string, ExistingEM>()
  misModelos.forEach((em) => existingMap.set(emKey(em.subcategoriaId, em.marcaId, em.modeloId), em))

  const { data: marcaData, loading: marcaLoading } = useQuery(MARCAS_QUERY, {
    variables: { subcategoriaSlug: selectedSub?.slug ?? '' },
    skip: !selectedSub,
    fetchPolicy: 'cache-first',
  })
  const { data: modeloData, loading: modeloLoading } = useQuery(MODELOS_QUERY, {
    variables: { subcategoriaSlug: selectedSub?.slug ?? '' },
    skip: !selectedSub,
    fetchPolicy: 'cache-first',
  })

  const marcas: Marca[] = (marcaData?.marcas ?? []).filter((m: Marca) => m.status === 'aprobada')
  const allModelos: Modelo[] = modeloData?.modelos ?? []

  const modelosByMarca = new Map<string | null, Modelo[]>()
  allModelos.forEach((m) => {
    const k = m.marcaId ?? null
    if (!modelosByMarca.has(k)) modelosByMarca.set(k, [])
    modelosByMarca.get(k)!.push(m)
  })
  const genericModelos = modelosByMarca.get(null) ?? []

  const catalogLoading = marcaLoading || modeloLoading

  const filteredSubs = empresaSubs.filter((s) =>
    s.nombre.toLowerCase().includes(subSearch.toLowerCase())
  )

  const handleSolicited = (item: PendingItem) => {
    setLocalPending((prev) => prev.some((p) => p.modeloId === item.modeloId) ? prev : [...prev, item])
  }

  const switchSub = (sub: Subcategoria) => {
    setSelectedSub(sub)
    setLocalPending([])
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Marcas y Modelos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Indica exactamente qué marcas y modelos manejas para que tus clientes puedan encontrarte fácilmente.
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 text-blue-800 text-sm px-4 py-3 rounded-xl mb-6">
        <Info size={16} className="shrink-0 mt-0.5 text-blue-500" />
        <p>
          Si tu marca o modelo no están en el sistema, deberán pasar por un proceso de autorización.
          Te avisaremos en cuanto tengamos respuesta.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {(['mis-productos', 'mis-modelos', 'mis-solicitudes'] as ActiveTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'mis-modelos' ? 'Mis modelos' : tab === 'mis-solicitudes' ? 'Mis solicitudes' : 'Mis productos'}
          </button>
        ))}
      </div>

      {activeTab === 'mis-solicitudes' ? (
        <TabSolicitudes />
      ) : activeTab === 'mis-productos' ? (
        <TabProductos />
      ) : (
        <>
          {/* Subcategoria dropdown — sticky */}
          <div className="sticky top-0 z-10 bg-white border border-gray-200 rounded-2xl px-4 py-3 mb-4 shadow-sm">
            <p className="text-xs text-gray-400 font-medium mb-2">Línea de producto:</p>
            {misModelosLoading && empresaSubs.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Loader2 size={12} className="animate-spin" /> Cargando...
              </div>
            ) : empresaSubs.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No tienes subcategorías asignadas aún</p>
            ) : (
              <div ref={subDropRef} className="relative">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={selectedSub && !subOpen ? selectedSub.nombre : subSearch}
                    placeholder="Buscar línea de producto..."
                    onFocus={() => {
                      setSubOpen(true)
                      setSubSearch('')
                      setSubHighlight(-1)
                    }}
                    onChange={(e) => {
                      setSubSearch(e.target.value)
                      setSubOpen(true)
                      setSubHighlight(-1)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault()
                        setSubHighlight(h => Math.min(h + 1, filteredSubs.length - 1))
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault()
                        setSubHighlight(h => Math.max(h - 1, -1))
                      } else if (e.key === 'Enter') {
                        e.preventDefault()
                        if (filteredSubs[subHighlight]) {
                          switchSub(filteredSubs[subHighlight])
                          setSubOpen(false)
                          setSubSearch('')
                        }
                      } else if (e.key === 'Escape') {
                        setSubOpen(false)
                        setSubSearch('')
                      }
                    }}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    autoComplete="off"
                  />
                  {selectedSub && (
                    <button
                      onClick={() => { setSelectedSub(null); setSubSearch('') }}
                      className="text-gray-400 hover:text-gray-600 shrink-0"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                {subOpen && (
                  <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredSubs.map((sub, i) => (
                      <li
                        key={sub.id}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          switchSub(sub)
                          setSubOpen(false)
                          setSubSearch('')
                        }}
                        className={`px-3 py-2 text-sm cursor-pointer flex items-center gap-2 ${
                          sub.id === selectedSub?.id
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : i === subHighlight
                            ? 'bg-gray-100 text-gray-900'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {sub.id === selectedSub?.id && <CheckCircle2 size={12} className="text-blue-500 shrink-0" />}
                        {sub.nombre}
                      </li>
                    ))}
                    {filteredSubs.length === 0 && (
                      <li className="px-3 py-2 text-sm text-gray-400">Sin resultados</li>
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Catalog content */}
          {!selectedSub ? (
            <div className="text-center py-20 text-gray-400">
              <Box size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Selecciona una línea de producto para ver el catálogo</p>
            </div>
          ) : catalogLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-blue-500" size={28} />
            </div>
          ) : marcas.length === 0 && genericModelos.length === 0 ? (
            <div className="space-y-3">
              {/* Show empty generic section so user can still add */}
              <GenericSection
                modelos={[]}
                subcategoria={selectedSub}
                existingMap={existingMap}
                pendingItems={localPending.filter((p) => p.subcategoriaId === selectedSub.id && p.marcaId === null)}
                onSolicited={handleSolicited}
              />
              <div className="bg-white border border-dashed border-gray-200 rounded-2xl px-5 py-4">
                <InlineAgregarMarca subcategoriaId={selectedSub.id} />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {marcas.map((marca) => (
                <MarcaSection
                  key={marca.id}
                  marca={marca}
                  modelos={modelosByMarca.get(marca.id) ?? []}
                  subcategoria={selectedSub}
                  existingMap={existingMap}
                  pendingItems={localPending.filter(
                    (p) => p.subcategoriaId === selectedSub.id && p.marcaId === marca.id
                  )}
                  onSolicited={handleSolicited}
                  extraExistingItems={misModelos.filter(
                    (em) => em.subcategoriaId === selectedSub.id && em.marcaId === marca.id && em.modeloId !== null
                  )}
                />
              ))}

              <GenericSection
                modelos={genericModelos}
                subcategoria={selectedSub}
                existingMap={existingMap}
                pendingItems={localPending.filter(
                  (p) => p.subcategoriaId === selectedSub.id && p.marcaId === null
                )}
                onSolicited={handleSolicited}
              />

              <div className="bg-white border border-dashed border-gray-200 rounded-2xl px-5 py-4">
                <InlineAgregarMarca subcategoriaId={selectedSub.id} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
