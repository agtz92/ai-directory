'use client'

import { useQuery } from '@apollo/client'
import { ME_QUERY } from '@/lib/graphql/queries'

export default function ConfiguracionPage() {
  const { data, loading } = useQuery(ME_QUERY)
  const me = data?.me

  if (loading) return <div className="p-8 text-gray-400">Cargando...</div>

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Configuración</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div>
          <p className="text-sm text-gray-500">Correo electrónico</p>
          <p className="font-medium text-gray-900">{me?.email}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Workspace / Slug</p>
          <p className="font-mono text-sm text-gray-700">{me?.tenantSlug}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Plan</p>
          <p className="font-medium text-gray-900">{me?.tenantName}</p>
        </div>
      </div>
    </div>
  )
}
