'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@apollo/client'
import { STAFF_SOLICITUDES_QUERY } from '@/lib/graphql/queries'
import { STAFF_MARCAR_SOLICITUD_MUTATION } from '@/lib/graphql/mutations'
import { useStaffRole } from '@/lib/use-staff-role'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const STATUS_OPTIONS = ['nueva', 'vista', 'respondida', 'archivada']
const STATUS_COLORS: Record<string, string> = {
  nueva:       'bg-blue-100 text-blue-700',
  vista:       'bg-gray-100 text-gray-600',
  respondida:  'bg-green-100 text-green-700',
  archivada:   'bg-gray-100 text-gray-400',
}

export default function StaffLeadsPage() {
  const { tenantId } = useParams<{ tenantId: string }>()
  const router = useRouter()
  const { canManageLeads } = useStaffRole()

  // Redirect staff-role users (they can't access leads)
  useEffect(() => {
    if (!canManageLeads) {
      toast.error('No tienes permiso para ver leads')
      router.push(`/empresa/${tenantId}`)
    }
  }, [canManageLeads, router, tenantId])

  const { data, loading, refetch } = useQuery(STAFF_SOLICITUDES_QUERY, {
    variables: { tenantId, limit: 50, offset: 0 },
    skip: !canManageLeads,
  })

  const [marcar] = useMutation(STAFF_MARCAR_SOLICITUD_MUTATION)

  const leads = data?.staffSolicitudes ?? []

  const handleMarcar = async (solicitudId: string, status: string) => {
    try {
      await marcar({ variables: { tenantId, solicitudId, status } })
      toast.success(`Lead marcado como ${status}`)
      refetch()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  if (!canManageLeads) return null

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/empresa/${tenantId}`} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Leads del cliente</h1>
        <span className="text-sm text-gray-400">({leads.length} solicitudes)</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-blue-600" size={28} />
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Sin solicitudes de cotización</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Contacto</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Empresa compradora</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Mensaje</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {leads.map((lead: any) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{lead.nombreContacto}</p>
                    <p className="text-xs text-gray-500">{lead.emailContacto}</p>
                    {lead.telefono && <p className="text-xs text-gray-400">{lead.telefono}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{lead.empresaCompradora || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs">
                    <p className="truncate" title={lead.mensaje}>{lead.mensaje}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(lead.createdAt).toLocaleDateString('es-MX')}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={lead.status}
                      onChange={(e) => handleMarcar(lead.id, e.target.value)}
                      className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${STATUS_COLORS[lead.status] ?? ''}`}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
