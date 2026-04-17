'use client'

import { useEffect, useState } from 'react'
import { useMutation } from '@apollo/client'
import { usePlan, UNLIMITED } from '@/lib/use-plan'
import { useAuthStore } from '@/lib/auth-store'
import { CAMBIAR_PLAN_MUTATION } from '@/lib/graphql/mutations'
import { MI_EMPRESA_QUERY } from '@/lib/graphql/queries'
import { toast } from 'sonner'
import { Check, X, Sparkles, Mail, Loader2, ArrowRight } from 'lucide-react'

interface PlanLimits {
  maxCategorias:     number
  maxSubcategorias:  number
  puedeVerLeads:     boolean
  puedeSubirPortada: boolean
  maxFotosGaleria:   number
  badgeVerificado:   boolean
  soporte:           string
}

interface PlanInfo {
  slug: string; nombre: string; precioMensual: number; limits: PlanLimits
}

interface FeatureLine { label: string; text: string }

const PLANES_QUERY = `query { planes { slug nombre precioMensual limits { maxCategorias maxSubcategorias puedeVerLeads puedeSubirPortada maxFotosGaleria badgeVerificado soporte } } }`

const FEATURE_ROWS: { label: string; key: keyof PlanLimits; render: (v: number|boolean|string) => string }[] = [
  { label: 'Productos / Servicios', key: 'maxSubcategorias',  render: v => Number(v) >= UNLIMITED ? 'Sin límite' : `Hasta ${v}` },
  { label: 'Ver datos de leads',    key: 'puedeVerLeads',     render: v => v ? 'Incluido' : 'No incluido' },
  { label: 'Imagen de portada',     key: 'puedeSubirPortada', render: v => v ? 'Incluido' : 'No incluido' },
  { label: 'Fotos en galería',      key: 'maxFotosGaleria',   render: v => Number(v) >= UNLIMITED ? 'Sin límite' : Number(v) === 0 ? 'No incluido' : `Hasta ${v} fotos` },
  { label: 'Badge verificado',      key: 'badgeVerificado',   render: v => v ? 'Incluido' : 'No incluido' },
  { label: 'Soporte',               key: 'soporte',           render: v => ({ comunidad: 'Comunidad', email: 'Email', prioritario: 'Prioritario', dedicado: 'Dedicado' }[String(v)] ?? String(v)) },
]

const PLANES_FALLBACK: PlanInfo[] = [
  { slug: 'free',       nombre: 'Gratuito',   precioMensual: 0,   limits: { maxCategorias: 999, maxSubcategorias: 5,   puedeVerLeads: false, puedeSubirPortada: false, maxFotosGaleria: 0,   badgeVerificado: false, soporte: 'comunidad' } },
  { slug: 'starter',    nombre: 'Starter',    precioMensual: 299, limits: { maxCategorias: 999, maxSubcategorias: 15,  puedeVerLeads: true,  puedeSubirPortada: true,  maxFotosGaleria: 5,   badgeVerificado: false, soporte: 'email' } },
  { slug: 'pro',        nombre: 'Pro',        precioMensual: 799, limits: { maxCategorias: 999, maxSubcategorias: 999, puedeVerLeads: true,  puedeSubirPortada: true,  maxFotosGaleria: 20,  badgeVerificado: true,  soporte: 'prioritario' } },
  { slug: 'enterprise', nombre: 'Enterprise', precioMensual: 0,   limits: { maxCategorias: 999, maxSubcategorias: 999, puedeVerLeads: true,  puedeSubirPortada: true,  maxFotosGaleria: 999, badgeVerificado: true,  soporte: 'dedicado' } },
]

const PLAN_STYLE: Record<string, { accent: string; ring: string; badge: string; cta: string; gradient: string }> = {
  free:       { accent: 'border-slate-200 dark:border-slate-700',    ring: 'ring-slate-400',    badge: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',     cta: 'bg-slate-900 dark:bg-slate-700 text-white hover:bg-slate-800 dark:hover:bg-slate-600', gradient: 'from-slate-400 to-slate-500' },
  starter:    { accent: 'border-blue-200 dark:border-blue-800',      ring: 'ring-blue-500',     badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',     cta: 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/30',             gradient: 'from-blue-500 to-blue-700' },
  pro:        { accent: 'border-violet-300 dark:border-violet-700',  ring: 'ring-violet-500',   badge: 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300', cta: 'bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-900/30',       gradient: 'from-violet-500 to-violet-700' },
  enterprise: { accent: 'border-amber-200 dark:border-amber-800',   ring: 'ring-amber-500',    badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',   cta: 'bg-amber-500 text-white hover:bg-amber-400 shadow-lg shadow-amber-900/30',         gradient: 'from-amber-400 to-amber-600' },
}

function getPlanFeatures(plan: PlanInfo, previous: PlanInfo | null): FeatureLine[] {
  if (!previous) {
    return FEATURE_ROWS
      .map(({ label, key, render }) => ({ label, text: render(plan.limits[key] as number|boolean|string) }))
      .filter(({ text }) => !text.toLowerCase().includes('no incluido'))
  }
  const diffs: FeatureLine[] = []
  for (const { label, key, render } of FEATURE_ROWS) {
    const cur = plan.limits[key]; const prev = previous.limits[key]
    let improved = false
    if (typeof cur === 'boolean' && typeof prev === 'boolean') improved = cur && !prev
    else if (typeof cur === 'number' && typeof prev === 'number') improved = cur > prev
    else if (typeof cur === 'string' && typeof prev === 'string') improved = cur !== prev
    if (improved) diffs.push({ label, text: render(cur as number|boolean|string) })
  }
  return diffs
}

export default function PlanesPage() {
  const { plan: currentPlan } = usePlan()
  const setMe = useAuthStore((s) => s.setMe)
  const [planes, setPlanes] = useState<PlanInfo[]>(PLANES_FALLBACK)
  const [loadingData, setLoadingData] = useState(true)
  const [confirming, setConfirming] = useState<string | null>(null)

  const [cambiarPlan, { loading: changing }] = useMutation(CAMBIAR_PLAN_MUTATION, {
    refetchQueries: [MI_EMPRESA_QUERY],
    onCompleted(data) {
      if (data?.cambiarPlan) setMe(data.cambiarPlan)
      toast.success('Plan actualizado correctamente')
      setConfirming(null)
    },
    onError(err) {
      toast.error(err.graphQLErrors?.[0]?.message ?? err.message ?? 'Error al cambiar plan')
      setConfirming(null)
    },
  })

  async function handleCambiarPlan(slug: string) {
    if (confirming !== slug) { setConfirming(slug); return }
    await cambiarPlan({ variables: { plan: slug } })
  }

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:8000/graphql/'
    const url = process.env.NEXT_PUBLIC_PUBLIC_GRAPHQL_URL ?? base.replace(/\/graphql\/?$/, '/public/graphql/')
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: PLANES_QUERY }) })
      .then(r => r.json())
      .then(d => { const fetched = d.data?.planes ?? []; if (fetched.length > 0) setPlanes(fetched); setLoadingData(false) })
      .catch(() => setLoadingData(false))
  }, [])

  if (loadingData) {
    return (
      <div className="p-8 flex items-center gap-3 text-slate-400 dark:text-slate-500">
        <Loader2 size={18} className="animate-spin" />
        Cargando planes...
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Planes y precios</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Plan actual:{' '}
          <span className="font-semibold text-blue-600 dark:text-blue-400 capitalize">{currentPlan}</span>
        </p>
      </div>

      {/* ── Plan cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-12">
        {planes.map((plan, idx) => {
          const previous    = idx > 0 ? planes[idx - 1] : null
          const features    = getPlanFeatures(plan, previous)
          const style       = PLAN_STYLE[plan.slug] ?? PLAN_STYLE.free
          const isCurrent   = plan.slug === currentPlan
          const isEnterprise = plan.slug === 'enterprise'
          const isPro       = plan.slug === 'pro'

          return (
            <div
              key={plan.slug}
              className={`relative rounded-2xl border-2 overflow-hidden flex flex-col bg-white dark:bg-slate-900 transition-shadow hover:shadow-xl dark:hover:shadow-black/30 ${style.accent} ${isCurrent ? `ring-2 ring-offset-2 dark:ring-offset-slate-950 ${style.ring}` : ''}`}
            >
              {/* Gradient top strip */}
              <div className={`h-1.5 w-full bg-gradient-to-r ${style.gradient}`} />

              {/* Badges */}
              {isCurrent && (
                <div className="absolute top-4 right-4">
                  <span className="text-xs font-semibold bg-blue-600 text-white px-2.5 py-1 rounded-full">
                    Tu plan
                  </span>
                </div>
              )}
              {isPro && !isCurrent && (
                <div className="absolute top-4 right-4">
                  <span className="text-xs font-semibold bg-violet-600 text-white px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Sparkles size={10} /> Popular
                  </span>
                </div>
              )}

              {/* Header */}
              <div className="px-5 pt-5 pb-4">
                <p className="font-bold text-slate-900 dark:text-slate-100 text-lg">{plan.nombre}</p>
                {isEnterprise ? (
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">A la medida</p>
                ) : plan.precioMensual === 0 ? (
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">Gratis</p>
                ) : (
                  <p className="mt-1 flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      ${plan.precioMensual.toLocaleString('es-MX')}
                    </span>
                    <span className="text-sm text-slate-400">/mes</span>
                  </p>
                )}
              </div>

              {/* Divider */}
              <div className="mx-5 border-t border-slate-100 dark:border-slate-800" />

              {/* Features */}
              <div className="px-5 py-4 flex-1">
                {previous && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
                    Todo lo del plan <span className="font-semibold text-slate-500 dark:text-slate-400">{previous.nombre}</span>, más:
                  </p>
                )}
                {features.length > 0 ? (
                  <ul className="space-y-2">
                    {features.map(({ label, text }) => (
                      <li key={label} className="flex items-start gap-2 text-sm">
                        <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0 mt-0.5">
                          <Check size={10} className="text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
                        </div>
                        <span className="text-slate-700 dark:text-slate-300">
                          <span className="font-medium">{label}:</span>{' '}{text}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-400 italic">Sin cambios adicionales.</p>
                )}
              </div>

              {/* CTA */}
              <div className="px-5 pb-5">
                {isCurrent ? (
                  <div className={`w-full text-center text-sm font-medium py-2.5 rounded-xl ${style.badge}`}>
                    Plan activo
                  </div>
                ) : isEnterprise ? (
                  <a
                    href="mailto:ventas@directorio.ai"
                    className={`w-full flex items-center justify-center gap-2 text-sm font-medium py-2.5 rounded-xl transition-all ${style.cta}`}
                  >
                    <Mail size={14} /> Contactar ventas
                  </a>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleCambiarPlan(plan.slug)}
                      disabled={changing}
                      className={`w-full flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 rounded-xl transition-all disabled:opacity-60 cursor-pointer ${
                        confirming === plan.slug
                          ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/30'
                          : style.cta
                      }`}
                    >
                      {changing && confirming === plan.slug ? (
                        <><Loader2 size={13} className="animate-spin" /> Cambiando...</>
                      ) : confirming === plan.slug ? (
                        <><Check size={14} strokeWidth={3} /> Confirmar cambio</>
                      ) : (
                        <>Cambiar a {plan.nombre} <ArrowRight size={13} /></>
                      )}
                    </button>
                    {confirming === plan.slug && (
                      <button
                        onClick={() => setConfirming(null)}
                        className="w-full text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors py-1 cursor-pointer"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Comparison table (desktop) ───────────────────────────────── */}
      <div className="hidden lg:block">
        <h2 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-4">Comparativa completa</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <th className="text-left px-5 py-3.5 font-medium text-slate-500 dark:text-slate-400 w-1/3">Característica</th>
                {planes.map(plan => (
                  <th key={plan.slug} className={`px-4 py-3.5 text-center font-semibold ${
                    plan.slug === currentPlan
                      ? 'text-blue-700 dark:text-blue-400'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {plan.nombre}
                    {plan.slug === currentPlan && (
                      <span className="ml-1.5 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full">actual</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {FEATURE_ROWS.map(({ label, key, render }) => (
                <tr key={key} className="bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-300">{label}</td>
                  {planes.map(plan => {
                    const raw = plan.limits[key]
                    const isBool = typeof raw === 'boolean'
                    const text = render(raw as number|boolean|string)
                    const isPos = isBool ? raw === true : !text.toLowerCase().includes('no incluido')
                    return (
                      <td key={plan.slug} className="px-4 py-3 text-center">
                        {isBool ? (
                          raw
                            ? <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto"><Check size={11} className="text-emerald-600 dark:text-emerald-400" strokeWidth={3} /></div>
                            : <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto"><X size={11} className="text-slate-400" strokeWidth={2.5} /></div>
                        ) : (
                          <span className={isPos ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600'}>{text}</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr className="bg-slate-50 dark:bg-slate-900 border-t-2 border-slate-200 dark:border-slate-700">
                <td className="px-5 py-4 font-bold text-slate-700 dark:text-slate-300">Precio mensual</td>
                {planes.map(plan => (
                  <td key={plan.slug} className={`px-4 py-4 text-center font-bold ${
                    plan.slug === currentPlan ? 'text-blue-700 dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'
                  }`}>
                    {plan.precioMensual === 0 && plan.slug !== 'enterprise' ? 'Gratis'
                      : plan.slug === 'enterprise' ? 'A la medida'
                      : `$${plan.precioMensual.toLocaleString('es-MX')}/mes`}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-6 text-xs text-slate-400 dark:text-slate-600">
        Para dudas sobre facturación contáctanos a{' '}
        <a href="mailto:soporte@directorio.ai" className="text-blue-500 hover:underline">soporte@directorio.ai</a>
      </p>
    </div>
  )
}
