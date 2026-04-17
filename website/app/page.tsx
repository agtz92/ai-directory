import Link from 'next/link'
import { gql } from '@/lib/graphql'
import { ArrowRight, Zap, Bot, ShieldCheck } from 'lucide-react'
import SearchBar from './components/SearchBar'

interface Categoria {
  id: string
  nombre: string
  slug: string
  icono: string
}

export const revalidate = 3600

const COLORS = [
  'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/50',
  'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 border-violet-100 dark:border-violet-900/50',
  'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50',
  'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/50',
  'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-900/50',
  'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-400 border-cyan-100 dark:border-cyan-900/50',
]

export default async function HomePage() {
  let categorias: Categoria[] = []
  let totalCategorias = 0
  try {
    const data = await gql<{ categorias: Categoria[] }>(
      `query { categorias(activasOnly: true) { id nombre slug icono } }`
    )
    totalCategorias = data.categorias.length
    categorias = data.categorias.slice(0, 24)
  } catch { /* offline */ }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 dark:from-slate-900 dark:via-blue-950 dark:to-indigo-950 px-4 py-24 text-center">
        {/* Background grid */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />

        <div className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/80 text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            {totalCategorias > 0 ? `${totalCategorias.toLocaleString()}+ subcategorías disponibles` : 'Directorio Industrial de México'}
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-5 leading-tight tracking-tight">
            Encuentra proveedores<br className="hidden md:block" />
            <span className="text-blue-200">industriales en México</span>
          </h1>
          <p className="text-blue-100/80 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            El directorio más completo de manufactura, construcción, química, alimentos y más.
          </p>

          <div className="max-w-xl mx-auto">
            <SearchBar size="lg" placeholder="Ej. válvulas industriales, maquinados, empaques..." />
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Explorar por categoría</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Más de 2,900 categorías industriales</p>
          </div>
          <Link
            href="/categorias"
            className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 font-medium hover:gap-2.5 transition-all"
          >
            Ver todas <ArrowRight size={15} />
          </Link>
        </div>

        {categorias.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {categorias.map((cat) => {
              const color = COLORS[parseInt(cat.id) % COLORS.length]
              return (
                <Link
                  key={cat.id}
                  href={`/categorias/${cat.slug}`}
                  className={`group border rounded-xl p-4 hover:scale-[1.03] hover:shadow-md transition-all duration-200 ${color}`}
                >
                  <div className="text-2xl mb-2">{cat.icono || '🏭'}</div>
                  <p className="text-xs font-semibold leading-snug line-clamp-2">
                    {cat.nombre}
                  </p>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Value props */}
      <section className="bg-slate-50 dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-800 py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center text-2xl font-bold text-slate-900 dark:text-slate-100 mb-12">
            ¿Por qué usar el directorio?
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { Icon: Zap, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40', title: 'Cotiza en minutos', desc: 'Envía tu solicitud directamente a la empresa. Sin llamadas, sin esperas innecesarias.' },
              { Icon: Bot, color: 'text-violet-500 bg-violet-50 dark:bg-violet-950/40', title: 'Chatbot 24/7', desc: 'Las empresas Pro tienen un asistente entrenado con sus catálogos. Resuelve dudas al instante.' },
              { Icon: ShieldCheck, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40', title: 'Empresas verificadas', desc: 'Proveedores con badge verificado han pasado por validación documental.' },
            ].map(({ Icon, color, title, desc }) => (
              <div key={title} className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${color}`}>
                  <Icon size={22} />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">{title}</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-600">
        © {new Date().getFullYear()} Directorio Industrial MX — Todos los derechos reservados
      </footer>
    </div>
  )
}
