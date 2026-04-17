'use client'

import { useQuery, useMutation } from '@apollo/client'
import { SOLICITUDES_QUERY, MI_EMPRESA_QUERY } from '@/lib/graphql/queries'
import { MARCAR_VISTA_MUTATION, ARCHIVAR_SOLICITUD_MUTATION } from '@/lib/graphql/mutations'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { Lock, Inbox } from 'lucide-react'
import { toast } from 'sonner'

const STATUS_LABELS: Record<string, string> = {
  nueva: 'Nueva',
  vista: 'Vista',
  respondida: 'Respondida',
  archivada: 'Archivada',
}

const STATUS_COLORS: Record<string, string> = {
  nueva: 'bg-blue-100 text-blue-700',
  vista: 'bg-gray-100 text-gray-600',
  respondida: 'bg-green-100 text-green-700',
  archivada: 'bg-red-50 text-red-500',
}

export default function LeadsPage() {
  const { data: empresaData } = useQuery(MI_EMPRESA_QUERY)
  const { data, loading, refetch } = useQuery(SOLICITUDES_QUERY, {
    variables: { limit: 50 },
  })

  const [marcarVista] = useMutation(MARCAR_VISTA_MUTATION, {
    refetchQueries: [SOLICITUDES_QUERY],
  })

  const [archivarSolicitud] = useMutation(ARCHIVAR_SOLICITUD_MUTATION, {
    refetchQueries: [SOLICITUDES_QUERY],
  })

  const empresa = empresaData?.miEmpresa
  const solicitudes = data?.solicitudesCotizacion ?? []
  const isFreePlan = empresa?.plan === 'free'

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Solicitudes de cotización</h1>
          <p className="text-sm text-gray-500">
            {solicitudes.length} solicitud{solicitudes.length !== 1 ? 'es' : ''}
          </p>
        </div>
      </div>

      {/* Free plan gate banner */}
      {isFreePlan && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3 mb-6">
          <Lock className="text-amber-500 shrink-0 mt-0.5" size={18} />
          <div>
            <p className="font-semibold text-amber-900">Plan Gratuito — contenido limitado</p>
            <p className="text-sm text-amber-700 mt-1">
              Puedes ver cuántas solicitudes tienes, pero el contenido está oculto.
              Activa Starter $299/mes para ver nombre, email y mensaje de cada lead.
            </p>
          </div>
        </div>
      )}

      {loading && <p className="text-gray-400">Cargando solicitudes...</p>}

      {!loading && solicitudes.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <Inbox size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">Aún no tienes solicitudes</p>
          <p className="text-sm mt-1">Cuando los compradores envíen una cotización, aparecerá aquí.</p>
        </div>
      )}

      <div className="space-y-3">
        {solicitudes.map((sol: any) => {
          const bloqueado = sol.ocultoFree || isFreePlan
          return (
            <div
              key={sol.id}
              className={`bg-white border rounded-xl p-5 relative ${bloqueado ? 'overflow-hidden' : ''}`}
            >
              {/* Blur overlay for free plan */}
              {bloqueado && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center rounded-xl z-10">
                  <div className="text-center">
                    <Lock className="mx-auto text-gray-400 mb-2" size={20} />
                    <p className="text-sm font-medium text-gray-600">Activa tu plan para ver este lead</p>
                  </div>
                </div>
              )}

              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[sol.status]}`}>
                      {STATUS_LABELS[sol.status]}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(sol.createdAt), { addSuffix: true, locale: es })}
                    </span>
                  </div>
                  <p className="font-semibold text-gray-900">
                    {bloqueado ? '••••••••••' : (sol.nombreContacto || 'Sin nombre')}
                  </p>
                  {sol.empresaCompradora && !bloqueado && (
                    <p className="text-sm text-gray-500">{sol.empresaCompradora}</p>
                  )}
                  {!bloqueado && sol.emailContacto && (
                    <p className="text-sm text-blue-600 mt-1">{sol.emailContacto}</p>
                  )}
                  {!bloqueado && sol.telefono && (
                    <p className="text-sm text-gray-500">{sol.telefono}</p>
                  )}
                  {!bloqueado && sol.mensaje && (
                    <p className="text-sm text-gray-700 mt-3 p-3 bg-gray-50 rounded-lg">{sol.mensaje}</p>
                  )}
                </div>

                {/* Actions */}
                {!bloqueado && sol.status === 'nueva' && (
                  <div className="flex gap-2 ml-4 shrink-0">
                    <button
                      onClick={() => marcarVista({ variables: { id: sol.id } }).catch(() => {})}
                      className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Marcar vista
                    </button>
                    <button
                      onClick={() => {
                        archivarSolicitud({ variables: { id: sol.id } })
                          .then(() => toast.success('Solicitud archivada'))
                          .catch(() => {})
                      }}
                      className="text-xs text-red-500 border border-red-100 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Archivar
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
