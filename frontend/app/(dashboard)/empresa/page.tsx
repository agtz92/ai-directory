'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useLazyQuery } from '@apollo/client'
import { MI_EMPRESA_QUERY, SUBCATEGORIAS_SEARCH_QUERY } from '@/lib/graphql/queries'
import { useDebounce } from '@/lib/use-debounce'
import { CREAR_EMPRESA_MUTATION, ACTUALIZAR_EMPRESA_MUTATION, PUBLICAR_EMPRESA_MUTATION } from '@/lib/graphql/mutations'
import { toast } from 'sonner'
import { Building2, Upload, Tag, Phone, Globe, CheckCircle, X, ArrowUpCircle, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { UNLIMITED } from '@/lib/use-plan'
import { usePlan } from '@/lib/use-plan'
import { useAuthStore } from '@/lib/auth-store'

interface SubItem {
  id: string
  nombre: string
  slug: string
  categoriaId: string
  categoriaNombre: string
}

const TABS = [
  { id: 'info',       label: 'Información',  icon: Building2 },
  { id: 'contacto',   label: 'Contacto',     icon: Phone },
  { id: 'imagenes',   label: 'Imágenes',     icon: Upload },
  { id: 'estado',     label: 'Estado',       icon: CheckCircle },
]

const ESTADOS_MX = [
  'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas',
  'Chihuahua','Ciudad de México','Coahuila','Colima','Durango','Estado de México',
  'Guanajuato','Guerrero','Hidalgo','Jalisco','Michoacán','Morelos','Nayarit',
  'Nuevo León','Oaxaca','Puebla','Querétaro','Quintana Roo','San Luis Potosí',
  'Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas',
]

export default function EmpresaPage() {
  const [activeTab, setActiveTab] = useState('info')

  const [subSearch, setSubSearch] = useState('')
  const [subOpen, setSubOpen] = useState(false)
  const [subHighlight, setSubHighlight] = useState(-1)
  const subRef = useRef<HTMLDivElement>(null)

  // Optimistic subcategory state
  const [confirmedSubs, setConfirmedSubs] = useState<SubItem[]>([])
  const [pendingAdd, setPendingAdd] = useState<Set<string>>(new Set())
  const [pendingRemove, setPendingRemove] = useState<Set<string>>(new Set())
  // Accumulates every sub object ever seen — keeps chip names after search clears
  const [subCache, setSubCache] = useState<Map<string, SubItem>>(new Map())

  const { limits, atLeast } = usePlan()
  const maxSubcategorias = limits.maxSubcategorias
  const token = useAuthStore((s) => s.token)
  const [uploadingCsf, setUploadingCsf] = useState(false)

  async function handleSubirCsf(file: File) {
    setUploadingCsf(true)
    try {
      const operations = JSON.stringify({
        query: `mutation SubirCsf($file: Upload!) { subirCsf(file: $file) { id csfStatus csfUrl } }`,
        variables: { file: null },
      })
      const map = JSON.stringify({ '0': ['variables.file'] })
      const fd = new FormData()
      fd.append('operations', operations)
      fd.append('map', map)
      fd.append('0', file)
      const url = process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:8000/graphql/'
      const authToken = useAuthStore.getState().token
      const res = await fetch(url, {
        method: 'POST',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        body: fd,
      })
      const json = await res.json()
      if (json.errors) throw new Error(json.errors[0].message)
      await refetch()
      toast.success('Documento enviado. Lo revisaremos en breve.')
    } catch (err: any) {
      toast.error(err?.message ?? 'Error al subir el documento')
    } finally {
      setUploadingCsf(false)
    }
  }

  const { data, loading, refetch } = useQuery(MI_EMPRESA_QUERY, {
    fetchPolicy: 'cache-and-network',
    skip: !token,
  })
  const [crearEmpresa] = useMutation(CREAR_EMPRESA_MUTATION, {
    refetchQueries: [MI_EMPRESA_QUERY],
  })

  // For form saves — refetches full profile (score, status, etc.)
  const [actualizarEmpresa, { loading: saving }] = useMutation(ACTUALIZAR_EMPRESA_MUTATION, {
    refetchQueries: [MI_EMPRESA_QUERY],
  })

  // For subcategory toggles — NO refetchQueries; Apollo auto-updates from mutation response
  const [toggleSubcategoriaMutation] = useMutation(ACTUALIZAR_EMPRESA_MUTATION)

  const [publicarEmpresa] = useMutation(PUBLICAR_EMPRESA_MUTATION, {
    refetchQueries: [MI_EMPRESA_QUERY],
  })

  // Lazy search — fires only when user types ≥2 chars
  const [searchSubs, { data: searchData, loading: searchLoading }] = useLazyQuery(SUBCATEGORIAS_SEARCH_QUERY, {
    fetchPolicy: 'cache-first',
  })
  const debouncedSearch = useDebounce(subSearch, 300)

  const empresa = data?.miEmpresa

  // Over-limit: empresa has more subcategorías than the current plan allows
  // (can happen after a downgrade — existing data is never auto-deleted)
  const isOverLimit = (
    empresa != null &&
    maxSubcategorias < UNLIMITED &&
    confirmedSubs.length > maxSubcategorias
  )
  const exceso = isOverLimit ? confirmedSubs.length - maxSubcategorias : 0

  // ── Read ?tab= from URL on mount (e.g. redirect from /empresa/categorias) ──
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab')
    if (tab && TABS.some(t => t.id === tab)) setActiveTab(tab)
  }, [])

  // ── Close dropdown on outside click ──────────────────────────────────────
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

  // ── Sync confirmed subs from server ──────────────────────────────────────
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

  // ── Populate subCache with search results ────────────────────────────────
  useEffect(() => {
    const results = searchData?.subcategorias as SubItem[] | undefined
    if (!results?.length) return
    setSubCache(prev => {
      const next = new Map(prev)
      results.forEach(s => next.set(s.id, s))
      return next
    })
  }, [searchData])

  // ── Fire lazy search on debounced input ──────────────────────────────────
  useEffect(() => {
    const trimmed = debouncedSearch.trim()
    if (trimmed.length < 2) return
    searchSubs({ variables: { search: trimmed, limit: 20 } })
  }, [debouncedSearch])

  // ── Optimistic derivations ────────────────────────────────────────────────
  const displayedSubs = useMemo<SubItem[]>(() => {
    const base = confirmedSubs.filter(s => !pendingRemove.has(s.id))
    const added = [...pendingAdd]
      .map(id => subCache.get(id))
      .filter((s): s is SubItem => Boolean(s))
    return [...base, ...added]
  }, [confirmedSubs, pendingAdd, pendingRemove, subCache])

  const derivedCats = useMemo<string[]>(
    () => [...new Set(displayedSubs.map(s => s.categoriaNombre).filter(Boolean))],
    [displayedSubs]
  )

  const displayedIds = useMemo(() => new Set(displayedSubs.map(s => s.id)), [displayedSubs])

  const searchResults: SubItem[] = (searchData?.subcategorias ?? []) as SubItem[]
  const availableSubs = useMemo<SubItem[]>(
    () => searchResults.filter(s => !displayedIds.has(s.id)),
    [searchResults, displayedIds]
  )

  async function handleToggleSubcategoria(sub: SubItem) {
    // Prevent double-click while in-flight
    if (pendingAdd.has(sub.id) || pendingRemove.has(sub.id)) return

    const isSelected = displayedIds.has(sub.id)

    if (!isSelected && displayedSubs.length >= maxSubcategorias) {
      toast.error(`Tu plan permite hasta ${maxSubcategorias} productos/servicios.`)
      return
    }

    // 1. Optimistic update — instant chip
    if (isSelected) {
      setPendingRemove(prev => new Set([...prev, sub.id]))
    } else {
      setSubCache(prev => { const n = new Map(prev); n.set(sub.id, sub); return n })
      setPendingAdd(prev => new Set([...prev, sub.id]))
    }
    setSubSearch('')
    setSubOpen(false)
    setSubHighlight(-1)

    // 2. Send confirmed state to server (not optimistic — avoids race conditions)
    const confirmedIds = confirmedSubs.map(s => s.id)
    const newIds = isSelected
      ? confirmedIds.filter(id => id !== sub.id)
      : [...confirmedIds, sub.id]

    try {
      await toggleSubcategoriaMutation({ variables: { subcategoriaIds: newIds } })
      // Success: Apollo updates cache → useEffect syncs confirmedSubs + clears pending
    } catch (err: any) {
      // 3. Revert optimistic update
      if (isSelected) {
        setPendingRemove(prev => { const n = new Set(prev); n.delete(sub.id); return n })
      } else {
        setPendingAdd(prev => { const n = new Set(prev); n.delete(sub.id); return n })
      }
      const msg = err?.graphQLErrors?.[0]?.message ?? err?.message ?? 'Error al actualizar subcategorías'
      toast.error(msg)
    }
  }

  // Form state
  const [form, setForm] = useState({
    nombreComercial: '',
    descripcion: '',
    ciudad: '',
    estado: '',
    pais: 'México',
    telefono: '',
    emailContacto: '',
    sitioWeb: '',
    whatsapp: '',
  })

  // Sync form from API data whenever empresa loads or changes
  useEffect(() => {
    if (!empresa) return
    setForm({
      nombreComercial: empresa.nombreComercial ?? '',
      descripcion: empresa.descripcion ?? '',
      ciudad: empresa.ciudad ?? '',
      estado: empresa.estado ?? '',
      pais: empresa.pais ?? 'México',
      telefono: empresa.telefono ?? '',
      emailContacto: empresa.emailContacto ?? '',
      sitioWeb: empresa.sitioWeb ?? '',
      whatsapp: empresa.whatsapp ?? '',
    })
  }, [empresa?.id])

  const handleSave = async () => {
    try {
      if (!empresa) {
        // Create new profile
        await crearEmpresa({
          variables: {
            nombreComercial: form.nombreComercial,
            ciudad: form.ciudad,
            estado: form.estado,
          },
        })
        toast.success('Perfil creado exitosamente')
      } else {
        await actualizarEmpresa({ variables: form })
        toast.success('Perfil guardado')
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Error al guardar')
    }
  }

  const handlePublish = async () => {
    try {
      await publicarEmpresa()
      toast.success('¡Empresa publicada en el directorio!')
    } catch (err: any) {
      toast.error(err.message ?? 'Error al publicar')
    }
  }

  if (!token || (loading && data === undefined)) {
    return <div className="p-8 text-gray-400">Cargando...</div>
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mi Empresa</h1>
          <p className="text-sm text-gray-500">
            {empresa ? `Score: ${empresa.scoreCompletitud}/100` : 'Crea tu perfil para aparecer en el directorio'}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {/* Score bar */}
      {empresa && (
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Completitud del perfil</span>
            <span>{empresa.scoreCompletitud}/100</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{ width: `${empresa.scoreCompletitud}%` }}
            />
          </div>
        </div>
      )}

      {/* Over-limit banner */}
      {isOverLimit && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-red-700">Tu cuenta está pausada</p>
            <p className="text-sm text-red-600 mt-0.5">
              Tu plan permite hasta <strong>{maxSubcategorias}</strong> productos/servicios,
              pero tienes <strong>{confirmedSubs.length}</strong>.
              Elimina <strong>{exceso}</strong> para reactivar tu perfil en el directorio.
            </p>
            <button
              onClick={() => router.push('/empresa/modelos')}
              className="text-sm font-semibold text-red-700 underline underline-offset-2 mt-1.5 hover:text-red-900 transition-colors"
            >
              Ir a Productos →
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6">
        {TABS.map(({ id, label, icon: Icon }) => {
          const hasWarning = false
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`relative flex items-center gap-2 flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === id
                  ? 'bg-white shadow-sm ' + (hasWarning ? 'text-red-600' : 'text-blue-700')
                  : hasWarning ? 'text-red-500 hover:text-red-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {hasWarning
                ? <AlertTriangle size={14} className="shrink-0" />
                : <Icon size={14} className="shrink-0" />}
              <span className="hidden sm:inline">{label}</span>
              {hasWarning && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
          )
        })}
      </div>

      {/* Tab: Información */}
      {activeTab === 'info' && (
        <div className="space-y-5">
          <Field label="Nombre comercial" required>
            <input
              value={form.nombreComercial}
              onChange={(e) => setForm({ ...form, nombreComercial: e.target.value })}
              placeholder="Aceros del Norte S.A. de C.V."
              className={INPUT}
            />
          </Field>
          <Field label={`Descripción (${form.descripcion.length} caracteres — mínimo 100 para score completo)`}>
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              rows={5}
              placeholder="Describe los productos y servicios que ofrece tu empresa..."
              className={`${INPUT} resize-none`}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ciudad">
              <input
                value={form.ciudad}
                onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                placeholder="Monterrey"
                className={INPUT}
              />
            </Field>
            <Field label="Estado">
              <select
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
                className={INPUT}
              >
                <option value="">Seleccionar estado</option>
                {ESTADOS_MX.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </Field>
          </div>
        </div>
      )}

      {/* Tab: Contacto */}
      {activeTab === 'contacto' && (
        <div className="space-y-5">
          <Field label="Teléfono">
            <input
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              placeholder="+52 81 1234 5678"
              className={INPUT}
            />
          </Field>
          <Field label="Email de contacto">
            <input
              type="email"
              value={form.emailContacto}
              onChange={(e) => setForm({ ...form, emailContacto: e.target.value })}
              placeholder="ventas@tuempresa.com"
              className={INPUT}
            />
          </Field>
          <Field label="Sitio web">
            <input
              type="url"
              value={form.sitioWeb}
              onChange={(e) => setForm({ ...form, sitioWeb: e.target.value })}
              placeholder="https://tuempresa.com"
              className={INPUT}
            />
          </Field>
          <Field label="WhatsApp (número con código de país)">
            <input
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              placeholder="+52 81 1234 5678"
              className={INPUT}
            />
          </Field>
        </div>
      )}

      {/* Tab: Imágenes */}
      {activeTab === 'imagenes' && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Logo de la empresa</label>
            <p className="text-xs text-gray-400 mb-3">Recomendado: 200×200px, formato cuadrado. PNG o JPG.</p>
            <div className="flex items-center gap-4">
              {empresa?.logoUrl ? (
                <img src={empresa.logoUrl} alt="Logo" className="w-20 h-20 rounded-full object-cover border-2 border-gray-200" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <Building2 className="text-gray-300" size={28} />
                </div>
              )}
              <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm px-4 py-2 rounded-lg transition-colors">
                {empresa?.logoUrl ? 'Cambiar logo' : 'Subir logo'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  if (e.target.files?.[0]) toast.info('Upload de logo disponible vía API — conecta con subirLogo mutation')
                }} />
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Imagen de portada</label>
            <p className="text-xs text-gray-400 mb-3">Recomendado: 1200×400px, formato banner. PNG o JPG.</p>
            {empresa?.portadaUrl ? (
              <img src={empresa.portadaUrl} alt="Portada" className="w-full h-32 object-cover rounded-xl border border-gray-200 mb-2" />
            ) : (
              <div className="w-full h-32 rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center mb-2">
                <p className="text-sm text-gray-400">Sin portada</p>
              </div>
            )}
            <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm px-4 py-2 rounded-lg transition-colors">
              {empresa?.portadaUrl ? 'Cambiar portada' : 'Subir portada'}
              <input type="file" accept="image/*" className="hidden" onChange={() => {
                toast.info('Upload de portada disponible vía API — conecta con subirPortada mutation')
              }} />
            </label>
          </div>
        </div>
      )}

      {/* Tab: Categorías */}
      {activeTab === 'categorias' && (
        <div className="space-y-6">
          {isOverLimit ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>
                Debes eliminar <strong>{exceso} producto{exceso !== 1 ? 's' : ''}/servicio{exceso !== 1 ? 's' : ''}</strong> para
                quedar dentro del límite de tu plan ({maxSubcategorias} máximo).
                Haz clic en la <strong>✕</strong> de los que quieras quitar.
              </span>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              Agrega los productos o servicios que ofrece tu empresa. Las categorías se asignan automáticamente.
              {empresa?.plan === 'free' && ' Plan Gratuito: máximo 5 productos/servicios.'}
              {empresa?.plan === 'starter' && ' Plan Starter: hasta 15 productos/servicios.'}
            </div>
          )}

          <Field label="Productos / Servicios">
            {/* Selected subcategory chips — driven by optimistic displayedSubs */}
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
                      onClick={() => handleToggleSubcategoria(s)}
                      className="ml-0.5 hover:text-blue-900"
                      disabled={pendingAdd.has(s.id) || pendingRemove.has(s.id)}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {/* Autocomplete input — lazy search, fires after 300ms + 2 chars */}
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
                    if (availableSubs[subHighlight]) {
                      handleToggleSubcategoria(availableSubs[subHighlight])
                    }
                  } else if (e.key === 'Escape') {
                    setSubOpen(false)
                    setSubHighlight(-1)
                  }
                }}
                className={INPUT}
                autoComplete="off"
              />
              {subOpen && subSearch.trim().length >= 2 && (
                <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  {availableSubs.map((s, i) => (
                    <li
                      key={s.id}
                      onClick={() => handleToggleSubcategoria(s)}
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
                    <li className="px-3 py-2 text-xs text-gray-400 border-t border-gray-100 flex items-center gap-1.5">
                      ⌨ Sigue tecleando para cargar más opciones
                    </li>
                  )}
                </ul>
              )}
            </div>
          </Field>

          {/* Derived categories — read-only */}
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
      )}

      {/* Tab: Estado */}
      {activeTab === 'estado' && empresa && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">Estado actual</p>
                <p className="text-sm text-gray-500 mt-1">
                  {empresa.status === 'published' ? '✅ Publicado — visible en el directorio' :
                   empresa.status === 'draft' ? '🟡 Borrador — no visible al público' :
                   '🔴 Archivado'}
                </p>
              </div>
              {empresa.status !== 'published' && (
                <button
                  onClick={handlePublish}
                  className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  Publicar empresa
                </button>
              )}
            </div>
            {empresa.status === 'published' && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">URL pública</p>
                <a
                  href={`http://localhost:3001/empresas/${empresa.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-blue-600 font-mono hover:underline"
                >
                  /empresas/{empresa.slug}
                </a>
              </div>
            )}
          </div>
          {/* Verificación CSF */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="font-semibold text-gray-900">Verificación de empresa</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Sube tu Constancia de Situación Fiscal (CSF) para obtener el badge verificado.
                </p>
              </div>
              {empresa.verified && (
                <span className="shrink-0 inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 text-xs font-semibold px-3 py-1 rounded-full">
                  <CheckCircle size={12} /> Verificado
                </span>
              )}
            </div>

            {!atLeast('starter') ? (
              /* Free plan — locked */
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-between gap-4">
                <p className="text-sm text-gray-500">
                  Disponible desde el plan <span className="font-semibold">Starter</span>.
                </p>
                <Link
                  href="/planes"
                  className="shrink-0 text-sm font-medium text-blue-600 hover:underline"
                >
                  Ver planes →
                </Link>
              </div>
            ) : empresa.verified ? (
              /* Already verified */
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700">
                ✅ Tu empresa está verificada. El badge aparece en tu perfil público.
              </div>
            ) : empresa.csfStatus === 'pendiente' ? (
              /* Uploaded, awaiting review */
              <div className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                  🕐 Documento recibido — en revisión. Te avisaremos cuando esté aprobado.
                  {empresa.csfUrl && (
                    <a
                      href={empresa.csfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block mt-1 text-amber-700 font-medium hover:underline"
                    >
                      Ver documento enviado ↗
                    </a>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  ¿Necesitas reemplazarlo?{' '}
                  <label className="text-blue-600 cursor-pointer hover:underline">
                    Subir nuevo archivo
                    <input type="file" accept=".pdf,image/*" className="hidden"
                      onChange={e => { if (e.target.files?.[0]) handleSubirCsf(e.target.files[0]) }} />
                  </label>
                </p>
              </div>
            ) : empresa.csfStatus === 'rechazado' ? (
              /* Rejected */
              <div className="space-y-3">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                  ❌ Documento rechazado. Verifica que sea tu CSF actualizada y vuelve a subir.
                </div>
                <label className={`inline-flex items-center gap-2 cursor-pointer bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors ${uploadingCsf ? 'opacity-60 pointer-events-none' : ''}`}>
                  {uploadingCsf ? 'Subiendo...' : 'Subir nuevo documento'}
                  <input type="file" accept=".pdf,image/*" className="hidden"
                    onChange={e => { if (e.target.files?.[0]) handleSubirCsf(e.target.files[0]) }} />
                </label>
              </div>
            ) : (
              /* sin_enviar — default */
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Acepta archivos PDF o imagen (JPG, PNG). El documento debe ser legible y mostrar tu RFC.
                </p>
                <label className={`inline-flex items-center gap-2 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors ${uploadingCsf ? 'opacity-60 pointer-events-none' : ''}`}>
                  {uploadingCsf ? 'Subiendo...' : 'Subir Constancia de Situación Fiscal'}
                  <input type="file" accept=".pdf,image/*" className="hidden"
                    onChange={e => { if (e.target.files?.[0]) handleSubirCsf(e.target.files[0]) }} />
                </label>
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-gray-900 mb-1">Plan contratado</p>
                <p className="text-blue-600 font-medium">
                  {empresa.plan === 'free'       ? 'Gratuito' :
                   empresa.plan === 'starter'    ? 'Starter — $299/mes' :
                   empresa.plan === 'pro'        ? 'Pro — $799/mes' : 'Enterprise'}
                </p>
                {empresa.plan === 'free' && (
                  <p className="text-sm text-gray-500 mt-2">
                    Con una sola cotización ganada pagas 6 meses del plan Starter.
                  </p>
                )}
              </div>
              <Link
                href="/planes"
                className="inline-flex items-center gap-1.5 shrink-0 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors text-sm font-medium px-4 py-2 rounded-lg"
              >
                <ArrowUpCircle size={15} />
                Cambiar plan
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* If no empresa yet and tab is estado */}
      {activeTab === 'estado' && !empresa && (
        <div className="text-gray-400 text-sm">Primero crea y guarda tu perfil en la pestaña Información.</div>
      )}
    </div>
  )
}

const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}
