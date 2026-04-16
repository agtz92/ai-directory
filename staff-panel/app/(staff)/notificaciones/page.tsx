'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { toast } from 'sonner'
import { Bell, Tag, Box, CheckCheck, Check, X, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import {
  STAFF_NOTIFICACIONES_QUERY,
  STAFF_MARCAS_PENDIENTES_QUERY,
  STAFF_MODELOS_PENDIENTES_QUERY,
} from '@/lib/graphql/queries'
import {
  STAFF_APROBAR_MARCA_MUTATION,
  STAFF_RECHAZAR_MARCA_MUTATION,
  STAFF_APROBAR_MODELO_MUTATION,
  STAFF_RECHAZAR_MODELO_MUTATION,
  STAFF_MARCAR_NOTIFICACION_LEIDA_MUTATION,
  STAFF_MARCAR_TODAS_LEIDAS_MUTATION,
} from '@/lib/graphql/mutations'
import { useAuthStore } from '@/lib/auth-store'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Notificacion {
  id: string
  tipo: string
  referenciaId: number
  mensaje: string
  leida: boolean
  createdAt: string
}

interface Marca {
  id: string
  nombre: string
  slug: string
  descripcion: string
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
  status: string
  motivoRechazo: string
  orden: number
  createdAt: string
  marcaId: string
  marcaNombre: string
  subcategoriaId: string
  subcategoriaNombre: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Ahora mismo'
  if (mins < 60) return `Hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Hace ${hrs}h`
  return `Hace ${Math.floor(hrs / 24)}d`
}

const TIPO_LABELS: Record<string, string> = {
  marca_nueva: 'Nueva marca',
  modelo_nuevo: 'Nuevo modelo',
}

// ─── Reject input component ───────────────────────────────────────────────────

function RejectInput({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: (motivo: string) => void
  onCancel: () => void
  loading: boolean
}) {
  const [motivo, setMotivo] = useState('')
  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Motivo de rechazo (opcional)..."
        rows={2}
        className="w-full text-sm border border-red-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onConfirm(motivo)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          <X size={13} />
          Confirmar rechazo
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg disabled:opacity-50 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ─── Marca card ───────────────────────────────────────────────────────────────

function MarcaCard({ marca, onDone }: { marca: Marca; onDone: () => void }) {
  const [rejecting, setRejecting] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const [aprobar, { loading: loadingAprobar }] = useMutation(STAFF_APROBAR_MARCA_MUTATION, {
    onCompleted: () => { toast.success(`Marca "${marca.nombre}" aprobada`); onDone() },
    onError: (e) => toast.error(e.message),
  })
  const [rechazar, { loading: loadingRechazar }] = useMutation(STAFF_RECHAZAR_MARCA_MUTATION, {
    onCompleted: () => { toast.success(`Marca "${marca.nombre}" rechazada`); onDone() },
    onError: (e) => toast.error(e.message),
  })

  const loading = loadingAprobar || loadingRechazar

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">{marca.nombre}</span>
            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              Marca
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Subcategoría: <span className="text-gray-700 font-medium">{marca.subcategoriaNombre}</span>
          </p>
          {marca.descripcion && (
            <p className="text-xs text-gray-600 mt-1 line-clamp-2">{marca.descripcion}</p>
          )}
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap shrink-0 flex items-center gap-1">
          <Clock size={11} />
          {timeAgo(marca.createdAt)}
        </span>
      </div>

      {/* Actions */}
      {!rejecting ? (
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => aprobar({ variables: { marcaId: marca.id } })}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors"
          >
            <Check size={13} />
            Aprobar
          </button>
          <button
            onClick={() => setRejecting(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 text-xs font-medium rounded-lg border border-red-200 disabled:opacity-50 transition-colors"
          >
            <X size={13} />
            Rechazar
          </button>
        </div>
      ) : (
        <RejectInput
          loading={loadingRechazar}
          onCancel={() => setRejecting(false)}
          onConfirm={(motivo) => rechazar({ variables: { marcaId: marca.id, motivo } })}
        />
      )}
    </div>
  )
}

// ─── Modelo card ──────────────────────────────────────────────────────────────

function ModeloCard({ modelo, onDone }: { modelo: Modelo; onDone: () => void }) {
  const [rejecting, setRejecting] = useState(false)

  const [aprobar, { loading: loadingAprobar }] = useMutation(STAFF_APROBAR_MODELO_MUTATION, {
    onCompleted: () => { toast.success(`Modelo "${modelo.nombre}" aprobado`); onDone() },
    onError: (e) => toast.error(e.message),
  })
  const [rechazar, { loading: loadingRechazar }] = useMutation(STAFF_RECHAZAR_MODELO_MUTATION, {
    onCompleted: () => { toast.success(`Modelo "${modelo.nombre}" rechazado`); onDone() },
    onError: (e) => toast.error(e.message),
  })

  const loading = loadingAprobar || loadingRechazar

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">{modelo.nombre}</span>
            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              Modelo
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Marca: <span className="text-gray-700 font-medium">{modelo.marcaNombre}</span>
            {' · '}
            Subcategoría: <span className="text-gray-700 font-medium">{modelo.subcategoriaNombre}</span>
          </p>
          {modelo.descripcion && (
            <p className="text-xs text-gray-600 mt-1 line-clamp-2">{modelo.descripcion}</p>
          )}
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap shrink-0 flex items-center gap-1">
          <Clock size={11} />
          {timeAgo(modelo.createdAt)}
        </span>
      </div>

      {!rejecting ? (
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => aprobar({ variables: { modeloId: modelo.id } })}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors"
          >
            <Check size={13} />
            Aprobar
          </button>
          <button
            onClick={() => setRejecting(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 text-xs font-medium rounded-lg border border-red-200 disabled:opacity-50 transition-colors"
          >
            <X size={13} />
            Rechazar
          </button>
        </div>
      ) : (
        <RejectInput
          loading={loadingRechazar}
          onCancel={() => setRejecting(false)}
          onConfirm={(motivo) => rechazar({ variables: { modeloId: modelo.id, motivo } })}
        />
      )}
    </div>
  )
}

// ─── Tab: Notificaciones ──────────────────────────────────────────────────────

function TabNotificaciones() {
  const { data, loading, refetch } = useQuery(STAFF_NOTIFICACIONES_QUERY, {
    variables: { soloNoLeidas: false },
    fetchPolicy: 'network-only',
  })
  const [marcarLeida] = useMutation(STAFF_MARCAR_NOTIFICACION_LEIDA_MUTATION, {
    onCompleted: () => refetch(),
  })
  const [marcarTodas, { loading: loadingTodas }] = useMutation(STAFF_MARCAR_TODAS_LEIDAS_MUTATION, {
    onCompleted: () => { toast.success('Todas marcadas como leídas'); refetch() },
    onError: (e) => toast.error(e.message),
  })

  const notifs: Notificacion[] = data?.staffNotificaciones ?? []
  const unread = notifs.filter((n) => !n.leida).length

  if (loading) return <LoadingState />

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {unread > 0
            ? <><span className="font-semibold text-gray-800">{unread}</span> sin leer</>
            : 'Todo al día'}
        </p>
        {unread > 0 && (
          <button
            onClick={() => marcarTodas()}
            disabled={loadingTodas}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
          >
            <CheckCheck size={14} />
            Marcar todas como leídas
          </button>
        )}
      </div>

      {notifs.length === 0 ? (
        <EmptyState icon={<Bell size={32} className="text-gray-300" />} text="Sin notificaciones" />
      ) : (
        <div className="space-y-2">
          {notifs.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                n.leida
                  ? 'bg-white border-gray-100 opacity-60'
                  : 'bg-blue-50 border-blue-100'
              }`}
            >
              <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${n.leida ? 'bg-gray-300' : 'bg-blue-500'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800">{n.mensaje}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                    <Clock size={10} />
                    {timeAgo(n.createdAt)}
                  </span>
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                    {TIPO_LABELS[n.tipo] ?? n.tipo}
                  </span>
                </div>
              </div>
              {!n.leida && (
                <button
                  onClick={() => marcarLeida({ variables: { notificacionId: n.id } })}
                  className="shrink-0 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                  title="Marcar como leída"
                >
                  <Check size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Marcas pendientes ───────────────────────────────────────────────────

function TabMarcas() {
  const { data, loading, refetch } = useQuery(STAFF_MARCAS_PENDIENTES_QUERY, {
    fetchPolicy: 'network-only',
  })
  const marcas: Marca[] = data?.staffMarcasPendientes ?? []

  if (loading) return <LoadingState />

  if (marcas.length === 0) {
    return (
      <EmptyState
        icon={<Tag size={32} className="text-gray-300" />}
        text="No hay marcas pendientes de aprobación"
      />
    )
  }

  return (
    <div className="space-y-3">
      {marcas.map((m) => (
        <MarcaCard key={m.id} marca={m} onDone={() => refetch()} />
      ))}
    </div>
  )
}

// ─── Tab: Modelos pendientes ──────────────────────────────────────────────────

function TabModelos() {
  const { data, loading, refetch } = useQuery(STAFF_MODELOS_PENDIENTES_QUERY, {
    fetchPolicy: 'network-only',
  })
  const modelos: Modelo[] = data?.staffModelosPendientes ?? []

  if (loading) return <LoadingState />

  if (modelos.length === 0) {
    return (
      <EmptyState
        icon={<Box size={32} className="text-gray-300" />}
        text="No hay modelos pendientes de aprobación"
      />
    )
  }

  return (
    <div className="space-y-3">
      {modelos.map((m) => (
        <ModeloCard key={m.id} modelo={m} onDone={() => refetch()} />
      ))}
    </div>
  )
}

// ─── Shared UI atoms ──────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 animate-pulse">
          <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon}
      <p className="text-sm text-gray-400 mt-3">{text}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'notificaciones', label: 'Notificaciones', icon: Bell },
  { key: 'marcas',         label: 'Marcas',         icon: Tag  },
  { key: 'modelos',        label: 'Modelos',        icon: Box  },
] as const

type TabKey = typeof TABS[number]['key']

export default function NotificacionesPage() {
  const [tab, setTab] = useState<TabKey>('notificaciones')
  const token = useAuthStore((s) => s.token)

  // badge counts for each tab
  const { data: notifData } = useQuery(STAFF_NOTIFICACIONES_QUERY, {
    variables: { soloNoLeidas: true },
    skip: !token,
    pollInterval: 30_000,
  })
  const { data: marcasData } = useQuery(STAFF_MARCAS_PENDIENTES_QUERY, {
    skip: !token,
    pollInterval: 30_000,
  })
  const { data: modelosData } = useQuery(STAFF_MODELOS_PENDIENTES_QUERY, {
    skip: !token,
    pollInterval: 30_000,
  })

  const counts: Record<TabKey, number> = {
    notificaciones: notifData?.staffNotificaciones?.length ?? 0,
    marcas:         marcasData?.staffMarcasPendientes?.length ?? 0,
    modelos:        modelosData?.staffModelosPendientes?.length ?? 0,
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Bell size={20} className="text-blue-500" />
          Notificaciones y aprobaciones
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Revisa y aprueba las marcas y modelos propuestos por los clientes.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative ${
              tab === key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={14} />
            {label}
            {counts[key] > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                tab === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-300 text-gray-600'
              }`}>
                {counts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'notificaciones' && <TabNotificaciones />}
      {tab === 'marcas'         && <TabMarcas />}
      {tab === 'modelos'        && <TabModelos />}
    </div>
  )
}
