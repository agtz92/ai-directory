'use client'

import { useQuery } from '@apollo/client'
import { STAFF_STATS_QUERY, STAFF_EMPRESAS_QUERY } from '@/lib/graphql/queries'
import { useAuthStore } from '@/lib/auth-store'
import { Building2, CheckCircle2, FileEdit, Archive } from 'lucide-react'

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number | string; icon: any; color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}

const PLAN_COLORS: Record<string, string> = {
  free:       'bg-gray-100 text-gray-600',
  starter:    'bg-blue-100 text-blue-700',
  pro:        'bg-purple-100 text-purple-700',
  enterprise: 'bg-amber-100 text-amber-700',
}

export default function StaffDashboardPage() {
  const token = useAuthStore((s) => s.token)
  const { data: statsData } = useQuery(STAFF_STATS_QUERY, { skip: !token })
  const { data: empresasData } = useQuery(STAFF_EMPRESAS_QUERY, {
    variables: { limit: 10, offset: 0 },
    skip: !token,
  })

  const stats = statsData?.staffStats
  const recientes = empresasData?.staffEmpresas?.empresas ?? []

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total empresas"
          value={stats?.totalEmpresas ?? '—'}
          icon={Building2}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Publicadas"
          value={stats?.publicadas ?? '—'}
          icon={CheckCircle2}
          color="bg-green-50 text-green-600"
        />
        <StatCard
          label="Borradores"
          value={stats?.borradores ?? '—'}
          icon={FileEdit}
          color="bg-yellow-50 text-yellow-600"
        />
        <StatCard
          label="Archivadas"
          value={stats?.archivadas ?? '—'}
          icon={Archive}
          color="bg-gray-100 text-gray-600"
        />
      </div>

      {/* Por plan */}
      {stats?.porPlan && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Por plan</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.porPlan as Record<string, number>).map(([plan, count]) => (
              <div key={plan} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${PLAN_COLORS[plan] ?? 'bg-gray-100 text-gray-600'}`}>
                {plan}: <span className="font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recientes */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Últimas registradas
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Empresa</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Ciudad</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Plan</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recientes.map((e: any) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{e.nombreComercial}</td>
                  <td className="px-4 py-3 text-gray-500">{e.ciudad || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[e.plan] ?? ''}`}>
                      {e.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{e.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
