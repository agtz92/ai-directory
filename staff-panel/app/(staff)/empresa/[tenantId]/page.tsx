'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation } from '@apollo/client'
import { STAFF_EMPRESA_QUERY } from '@/lib/graphql/queries'
import {
  STAFF_ACTUALIZAR_EMPRESA_MUTATION,
  STAFF_CAMBIAR_PLAN_MUTATION,
  STAFF_PUBLICAR_EMPRESA_MUTATION,
  STAFF_ARCHIVAR_EMPRESA_MUTATION,
  STAFF_DESPUBLICAR_EMPRESA_MUTATION,
} from '@/lib/graphql/mutations'
import { useStaffRole } from '@/lib/use-staff-role'
import { toast } from 'sonner'
import { AlertTriangle, Loader2, Save, ExternalLink, Package } from 'lucide-react'
import Link from 'next/link'

const TABS = ['Info', 'Contacto', 'Admin'] as const
type Tab = typeof TABS[number]

const PLANS = ['free', 'starter', 'pro', 'enterprise']

const ROLE_LABEL: Record<string, string> = {
  staff: 'Empleado', admin: 'Admin', owner: 'Owner',
}

export default function StaffEmpresaPage() {
  const { tenantId } = useParams<{ tenantId: string }>()
  const { role, canChangePlan, canManageLeads } = useStaffRole()
  const [tab, setTab] = useState<Tab>('Info')
  const [saving, setSaving] = useState(false)

  const { data, loading, refetch } = useQuery(STAFF_EMPRESA_QUERY, {
    variables: { tenantId },
    skip: !tenantId,
  })
  const empresa = data?.staffEmpresa

  // Form state
  const [nombreComercial, setNombreComercial] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [estado, setEstado] = useState('')
  const [telefono, setTelefono] = useState('')
  const [emailContacto, setEmailContacto] = useState('')
  const [sitioWeb, setSitioWeb] = useState('')
  const [whatsapp, setWhatsapp] = useState('')

  // Sync form with fetched data (on first load)
  const [initialized, setInitialized] = useState(false)
  if (empresa && !initialized) {
    setNombreComercial(empresa.nombreComercial ?? '')
    setDescripcion(empresa.descripcion ?? '')
    setCiudad(empresa.ciudad ?? '')
    setEstado(empresa.estado ?? '')
    setTelefono(empresa.telefono ?? '')
    setEmailContacto(empresa.emailContacto ?? '')
    setSitioWeb(empresa.sitioWeb ?? '')
    setWhatsapp(empresa.whatsapp ?? '')
    setInitialized(true)
  }

  const [actualizarEmpresa] = useMutation(STAFF_ACTUALIZAR_EMPRESA_MUTATION)
  const [cambiarPlan] = useMutation(STAFF_CAMBIAR_PLAN_MUTATION)
  const [publicar] = useMutation(STAFF_PUBLICAR_EMPRESA_MUTATION)
  const [archivar] = useMutation(STAFF_ARCHIVAR_EMPRESA_MUTATION)
  const [despublicar] = useMutation(STAFF_DESPUBLICAR_EMPRESA_MUTATION)

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      await actualizarEmpresa({
        variables: {
          tenantId,
          nombreComercial: nombreComercial || undefined,
          descripcion, ciudad, estado, telefono,
          emailContacto, sitioWeb, whatsapp,
        },
      })
      toast.success('Perfil guardado')
      refetch()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleChangePlan = async (plan: string) => {
    try {
      await cambiarPlan({ variables: { tenantId, plan } })
      toast.success(`Plan cambiado a ${plan}`)
      refetch()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handlePublicar = async () => {
    try {
      await publicar({ variables: { tenantId } })
      toast.success('Empresa publicada')
      refetch()
    } catch (err: any) { toast.error(err.message) }
  }

  const handleArchivar = async () => {
    if (!confirm('¿Archivar esta empresa?')) return
    try {
      await archivar({ variables: { tenantId } })
      toast.success('Empresa archivada')
      refetch()
    } catch (err: any) { toast.error(err.message) }
  }

  const handleDespublicar = async () => {
    try {
      await despublicar({ variables: { tenantId } })
      toast.success('Empresa regresada a borrador')
      refetch()
    } catch (err: any) { toast.error(err.message) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="animate-spin text-blue-600" size={32} />
    </div>
  )

  if (!empresa) return (
    <div className="p-8 text-gray-500">Empresa no encontrada</div>
  )

  return (
    <div className="p-8 max-w-3xl">
      {/* Staff banner */}
      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-sm text-amber-800">
        <AlertTriangle size={16} className="shrink-0 text-amber-500" />
        <span>
          <strong>Modo soporte · {ROLE_LABEL[role] ?? role}</strong> — los cambios afectan directamente al cliente
        </span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{empresa.nombreComercial}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-gray-500 capitalize">{empresa.status}</span>
            <span className="text-gray-300">·</span>
            <span className="text-sm text-gray-500 capitalize">{empresa.plan}</span>
            {empresa.ciudad && <>
              <span className="text-gray-300">·</span>
              <span className="text-sm text-gray-500">{empresa.ciudad}</span>
            </>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/empresa/${tenantId}/productos`}
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Package size={13} />
            Productos
          </Link>
          {canManageLeads && (
            <Link
              href={`/empresa/${tenantId}/leads`}
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
            >
              Ver leads <ExternalLink size={13} />
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab: Info */}
      {tab === 'Info' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre comercial</label>
            <input
              type="text"
              value={nombreComercial}
              onChange={(e) => setNombreComercial(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              rows={4}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
              <input type="text" value={ciudad} onChange={(e) => setCiudad(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <input type="text" value={estado} onChange={(e) => setEstado(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      )}

      {/* Tab: Contacto */}
      {tab === 'Contacto' && (
        <div className="space-y-4">
          {[
            { label: 'Teléfono', value: telefono, set: setTelefono },
            { label: 'Email de contacto', value: emailContacto, set: setEmailContacto },
            { label: 'Sitio web', value: sitioWeb, set: setSitioWeb },
            { label: 'WhatsApp', value: whatsapp, set: setWhatsapp },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input type="text" value={value} onChange={(e) => set(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      )}

      {/* Tab: Admin */}
      {tab === 'Admin' && (
        <div className="space-y-6">
          {/* IDs internos */}
          <div className="bg-gray-50 rounded-xl p-4 text-xs font-mono space-y-1 text-gray-500">
            <p>tenant_id: <span className="text-gray-800">{tenantId}</span></p>
            <p>empresa_id: <span className="text-gray-800">{empresa.id}</span></p>
            <p>slug: <span className="text-gray-800">{empresa.slug}</span></p>
            <p>score: <span className="text-gray-800">{empresa.scoreCompletitud}/100</span></p>
          </div>

          {/* Plan */}
          {canChangePlan ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cambiar plan</label>
              <div className="flex flex-wrap gap-2">
                {PLANS.map((p) => (
                  <button
                    key={p}
                    onClick={() => handleChangePlan(p)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors capitalize ${
                      empresa.plan === p
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Plan actual</p>
              <span className="text-sm font-medium capitalize text-blue-700">{empresa.plan}</span>
              <p className="text-xs text-gray-400 mt-1">Solo admin/owner puede cambiar el plan</p>
            </div>
          )}

          {/* Status */}
          {canChangePlan && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
              <div className="flex gap-2">
                {empresa.status !== 'published' && (
                  <button onClick={handlePublicar}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                    Publicar
                  </button>
                )}
                {empresa.status === 'published' && (
                  <button onClick={handleDespublicar}
                    className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600">
                    Pasar a borrador
                  </button>
                )}
                {empresa.status !== 'archived' && (
                  <button onClick={handleArchivar}
                    className="px-3 py-1.5 bg-gray-500 text-white rounded-lg text-sm font-medium hover:bg-gray-600">
                    Archivar
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
