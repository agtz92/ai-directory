'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle } from 'lucide-react'

export default function CotizacionPage() {
  const params = useParams()
  const empresaSlug = params.empresa_slug as string

  const [form, setForm] = useState({
    nombreContacto: '',
    emailContacto: '',
    telefono: '',
    empresaCompradora: '',
    mensaje: '',
  })
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/public/graphql/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation($empresaSlug: String!, $nombreContacto: String!, $emailContacto: String!,
                     $telefono: String!, $empresaCompradora: String!, $mensaje: String!) {
              enviarSolicitudCotizacion(
                empresaSlug: $empresaSlug
                nombreContacto: $nombreContacto
                emailContacto: $emailContacto
                telefono: $telefono
                empresaCompradora: $empresaCompradora
                mensaje: $mensaje
              )
            }
          `,
          variables: { empresaSlug, ...form },
        }),
      })
      const data = await res.json()
      if (data.errors?.length) throw new Error(data.errors[0].message)
      setSent(true)
    } catch (err: any) {
      setError(err.message || 'Error al enviar. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="text-emerald-500 dark:text-emerald-400" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">¡Solicitud enviada!</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
            Tu solicitud de cotización fue enviada exitosamente. La empresa se pondrá en contacto contigo pronto.
          </p>
          <a
            href={`/empresas/${empresaSlug}`}
            className="mt-6 inline-block text-blue-600 dark:text-blue-400 hover:underline text-sm"
          >
            ← Volver al perfil de la empresa
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Solicitud de cotización</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Completa el formulario — la empresa recibirá tu solicitud directamente.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tu nombre *">
              <input
                required
                value={form.nombreContacto}
                onChange={(e) => setForm({ ...form, nombreContacto: e.target.value })}
                placeholder="Juan García"
                className={INPUT}
              />
            </Field>
            <Field label="Tu empresa">
              <input
                value={form.empresaCompradora}
                onChange={(e) => setForm({ ...form, empresaCompradora: e.target.value })}
                placeholder="Constructora XYZ"
                className={INPUT}
              />
            </Field>
          </div>
          <Field label="Correo electrónico *">
            <input
              type="email"
              required
              value={form.emailContacto}
              onChange={(e) => setForm({ ...form, emailContacto: e.target.value })}
              placeholder="tu@empresa.com"
              className={INPUT}
            />
          </Field>
          <Field label="Teléfono">
            <input
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              placeholder="+52 81 1234 5678"
              className={INPUT}
            />
          </Field>
          <Field label="¿Qué necesitas? *">
            <textarea
              required
              rows={5}
              value={form.mensaje}
              onChange={(e) => setForm({ ...form, mensaje: e.target.value })}
              placeholder="Describe el producto o servicio que necesitas, cantidades, especificaciones técnicas, plazo de entrega..."
              className={`${INPUT} resize-none`}
            />
          </Field>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors"
          >
            {loading ? 'Enviando...' : 'Enviar solicitud de cotización'}
          </button>
        </form>
      </div>
    </div>
  )
}

const INPUT =
  'w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
      {children}
    </div>
  )
}
