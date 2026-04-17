'use client'

import { useQuery } from '@apollo/client'
import { DASHBOARD_STATS_QUERY, MI_EMPRESA_QUERY } from '@/lib/graphql/queries'
import { Eye, Inbox, Star, TrendingUp, AlertCircle, ArrowRight, CheckCircle2, Circle } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { data: statsData, loading: statsLoading } = useQuery(DASHBOARD_STATS_QUERY)
  const { data: empresaData, loading: empresaLoading } = useQuery(MI_EMPRESA_QUERY)

  const stats = statsData?.dashboardStats
  const empresa = empresaData?.miEmpresa

  const PLAN_LABELS: Record<string, string> = {
    free: 'Gratuito',
    starter: 'Starter — $299/mes',
    pro: 'Pro — $799/mes',
    enterprise: 'Enterprise',
  }

  const PLAN_COLORS: Record<string, string> = {
    free:       'from-slate-500 to-slate-600',
    starter:    'from-blue-500 to-blue-700',
    pro:        'from-violet-500 to-violet-700',
    enterprise: 'from-amber-500 to-amber-600',
  }

  const STAT_CARDS = [
    {
      label: 'Vistas del perfil',
      value: stats?.totalVistas ?? 0,
      icon: Eye,
      gradient: 'from-indigo-500 to-indigo-600',
      bg: 'bg-indigo-50 dark:bg-indigo-950/30',
      text: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      label: 'Leads totales',
      value: stats?.totalLeads ?? 0,
      icon: Inbox,
      gradient: 'from-emerald-500 to-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      text: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Leads nuevos',
      value: stats?.leadsNuevos ?? 0,
      icon: TrendingUp,
      gradient: 'from-orange-500 to-orange-600',
      bg: 'bg-orange-50 dark:bg-orange-950/30',
      text: 'text-orange-600 dark:text-orange-400',
    },
    {
      label: 'Score del perfil',
      value: `${stats?.scoreCompletitud ?? 0}`,
      suffix: '/100',
      icon: Star,
      gradient: 'from-yellow-400 to-yellow-600',
      bg: 'bg-yellow-50 dark:bg-yellow-950/30',
      text: 'text-yellow-600 dark:text-yellow-400',
    },
  ]

  const CHECKLIST = empresa ? [
    { label: 'Descripción completa',  done: empresa.descripcion?.length > 100 },
    { label: 'Logo subido',           done: !!empresa.logoUrl },
    { label: 'Imagen de portada',     done: !!empresa.portadaUrl },
    { label: 'Teléfono de contacto',  done: !!empresa.telefono },
    { label: 'Email de contacto',     done: !!empresa.emailContacto },
    { label: 'Sitio web',             done: !!empresa.sitioWeb },
    { label: 'Ciudad y estado',       done: !!(empresa.ciudad && empresa.estado) },
    { label: 'Al menos 1 categoría',  done: empresa.categorias?.length > 0 },
  ] : []

  const score = empresa?.scoreCompletitud ?? 0
  const scoreColor = score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-blue-500' : 'bg-orange-500'

  return (
    <div className="p-8 max-w-5xl">

      {/* ── Page header ────────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {empresa?.nombreComercial ?? 'Bienvenido al panel de control'}
        </p>
      </div>

      {/* ── No empresa alert ───────────────────────────────────────── */}
      {!empresaLoading && !empresa && (
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl p-5 flex items-start gap-4 mb-8">
          <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
            <AlertCircle className="text-blue-600 dark:text-blue-400" size={18} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-blue-900 dark:text-blue-300">Tu perfil está incompleto</p>
            <p className="text-sm text-blue-700 dark:text-blue-400 mt-0.5">
              Crea tu perfil de empresa para aparecer en el directorio.
            </p>
            <Link
              href="/empresa"
              className="mt-3 inline-flex items-center gap-1.5 bg-blue-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors font-medium"
            >
              Crear perfil <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}

      {/* ── Stats grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {STAT_CARDS.map(({ label, value, suffix, icon: Icon, gradient, bg, text }) => (
          <div
            key={label}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md dark:hover:shadow-black/20 transition-shadow"
          >
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-4 shadow-sm`}>
              <Icon size={17} className="text-white" strokeWidth={2} />
            </div>
            <div className="flex items-baseline gap-0.5">
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {statsLoading ? (
                  <span className="inline-block w-8 h-7 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                ) : value}
              </p>
              {suffix && !statsLoading && (
                <span className="text-sm text-slate-400 font-medium">{suffix}</span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Profile completeness ─────────────────────────────────── */}
        {empresa && (
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">Completitud del perfil</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Completa todos los campos para mejorar tu visibilidad</p>
              </div>
              <span className={`text-lg font-bold ${
                score >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                score >= 50 ? 'text-blue-600 dark:text-blue-400' :
                'text-orange-600 dark:text-orange-400'
              }`}>{score}<span className="text-sm font-normal text-slate-400">/100</span></span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-5 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-700 ${scoreColor}`}
                style={{ width: `${score}%` }}
              />
            </div>

            {/* Checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CHECKLIST.map(({ label, done }) => (
                <div key={label} className={`flex items-center gap-2 text-sm ${
                  done ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
                }`}>
                  {done
                    ? <CheckCircle2 size={15} className="shrink-0" />
                    : <Circle size={15} className="shrink-0" />
                  }
                  <span>{label}</span>
                </div>
              ))}
            </div>

            <Link
              href="/empresa"
              className="mt-5 inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline"
            >
              Completar perfil <ArrowRight size={13} />
            </Link>
          </div>
        )}

        {/* ── Plan card ────────────────────────────────────────────── */}
        {empresa && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Plan actual</p>
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${PLAN_COLORS[empresa.plan] ?? 'from-slate-500 to-slate-600'} flex items-center justify-center mb-3 shadow-sm`}>
              <Star size={18} className="text-white" strokeWidth={2} />
            </div>
            <p className="font-bold text-slate-900 dark:text-slate-100 text-lg">
              {PLAN_LABELS[empresa.plan] ?? empresa.plan}
            </p>
            {empresa.plan === 'free' && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 flex-1">
                Actualiza a Starter para ver tus leads y aparecer destacado.
              </p>
            )}
            <Link
              href="/planes"
              className="mt-4 inline-flex items-center justify-center gap-1.5 bg-slate-900 dark:bg-slate-700 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors font-medium"
            >
              {empresa.plan === 'free' ? 'Mejorar plan' : 'Ver planes'} <ArrowRight size={14} />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
