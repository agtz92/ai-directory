import { gql } from '@/lib/graphql'
import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Phone, Globe, MessageCircle, MapPin, Tag, ArrowRight, BadgeCheck } from 'lucide-react'

export const revalidate = 300

interface Props {
  params: Promise<{ empresa_slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { empresa_slug } = await params
  try {
    const data = await gql<{ empresa: any }>(`
      query($slug: String!) { empresa(slug: $slug) { nombreComercial ciudad estado descripcion } }
    `, { slug: empresa_slug })
    const e = data.empresa
    if (!e) return { title: 'Empresa no encontrada' }
    return {
      title: `${e.nombreComercial} — Proveedor Industrial en ${e.ciudad ?? 'México'}`,
      description: e.descripcion?.slice(0, 160) || `Perfil de ${e.nombreComercial} en el Directorio Industrial MX.`,
    }
  } catch {
    return { title: 'Directorio Industrial MX' }
  }
}

export default async function EmpresaPage({ params }: Props) {
  const { empresa_slug } = await params

  let empresa: any = null
  try {
    const data = await gql<{ empresa: any }>(`
      query($slug: String!) {
        empresa(slug: $slug) {
          id nombreComercial slug descripcion
          ciudad estado pais telefono sitioWeb whatsapp
          plan scoreCompletitud verified publishedAt
          logoUrl portadaUrl
          categoriaPrincipal { nombre slug }
          categorias { nombre slug }
        }
      }
    `, { slug: empresa_slug })
    empresa = data.empresa
  } catch {}

  if (!empresa) notFound()

  const initials = empresa.nombreComercial
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: empresa.nombreComercial,
    description: empresa.descripcion,
    address: {
      '@type': 'PostalAddress',
      addressLocality: empresa.ciudad,
      addressRegion: empresa.estado,
      addressCountry: 'MX',
    },
    telephone: empresa.telefono,
    url: empresa.sitioWeb,
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Portada */}
      <div className="w-full h-48 bg-gradient-to-br from-blue-700 to-indigo-900 dark:from-blue-950 dark:to-indigo-950 relative overflow-hidden">
        {empresa.portadaUrl && (
          <img src={empresa.portadaUrl} alt="Portada" className="w-full h-full object-cover" />
        )}
      </div>

      <div className="max-w-4xl mx-auto px-4">
        {/* Header card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 -mt-10 relative z-10 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-5">
            {/* Logo */}
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-950/40 dark:to-indigo-950/40 border-4 border-white dark:border-slate-900 shadow-sm shrink-0 overflow-hidden flex items-center justify-center">
              {empresa.logoUrl ? (
                <img src={empresa.logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{initials}</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{empresa.nombreComercial}</h1>
                {empresa.verified && (
                  <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full font-medium">
                    <BadgeCheck size={12} /> Verificado
                  </span>
                )}
                {empresa.plan !== 'free' && (
                  <span className="text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900 px-2 py-0.5 rounded-full capitalize">
                    {empresa.plan}
                  </span>
                )}
              </div>

              {(empresa.ciudad || empresa.estado) && (
                <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-3">
                  <MapPin size={13} />
                  {[empresa.ciudad, empresa.estado, empresa.pais].filter(Boolean).join(', ')}
                </p>
              )}

              <div className="flex flex-wrap gap-1.5">
                {empresa.categorias?.map((c: any) => (
                  <Link
                    key={c.slug}
                    href={`/categorias/${c.slug}`}
                    className="inline-flex items-center gap-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-700 dark:hover:text-blue-400 border border-transparent hover:border-blue-200 dark:hover:border-blue-900 px-2 py-0.5 rounded-full transition-colors"
                  >
                    <Tag size={10} />
                    {c.nombre}
                  </Link>
                ))}
              </div>
            </div>

            {/* CTA */}
            <Link
              href={`/cotizacion/${empresa.slug}`}
              className="shrink-0 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-colors shadow-sm"
            >
              Solicitar cotización <ArrowRight size={15} />
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 pb-16">
          {/* Main content */}
          <div className="md:col-span-2 space-y-6">
            {empresa.descripcion ? (
              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Acerca de la empresa</h2>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm whitespace-pre-line">
                  {empresa.descripcion}
                </p>
              </section>
            ) : (
              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Acerca de la empresa</h2>
                <p className="text-slate-400 dark:text-slate-600 text-sm italic">Sin descripción disponible.</p>
              </section>
            )}
          </div>

          {/* Contact sidebar */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Información de contacto</h3>
              <div className="space-y-3">
                {empresa.telefono && (
                  <a
                    href={`tel:${empresa.telefono}`}
                    className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    <Phone size={15} className="text-slate-400 dark:text-slate-600 shrink-0" />
                    {empresa.telefono}
                  </a>
                )}
                {empresa.sitioWeb && (
                  <a
                    href={empresa.sitioWeb}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-sm text-blue-600 dark:text-blue-400 hover:underline truncate"
                  >
                    <Globe size={15} className="text-slate-400 dark:text-slate-600 shrink-0" />
                    {empresa.sitioWeb.replace(/^https?:\/\//, '')}
                  </a>
                )}
                {empresa.whatsapp && (
                  <a
                    href={`https://wa.me/${empresa.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    <MessageCircle size={15} className="text-slate-400 dark:text-slate-600 shrink-0" />
                    WhatsApp
                  </a>
                )}
              </div>
              <Link
                href={`/cotizacion/${empresa.slug}`}
                className="mt-5 w-full block text-center bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white py-2.5 rounded-xl font-medium text-sm transition-colors"
              >
                Enviar solicitud de cotización
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
