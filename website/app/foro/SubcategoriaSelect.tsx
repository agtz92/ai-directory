'use client'

import { useRouter } from 'next/navigation'

type Item = { slug: string; nombre: string }

export default function SubcategoriaSelect({
  subcategorias,
  current,
}: {
  subcategorias: Item[]
  current: string | null
}) {
  const router = useRouter()

  return (
    <select
      value={current ?? ''}
      onChange={(e) => {
        const v = e.target.value
        router.push(v ? `/foro?subcategoria=${v}` : '/foro')
      }}
      className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
    >
      <option value="">Todas las categorías</option>
      {subcategorias.map((s) => (
        <option key={s.slug} value={s.slug}>
          {s.nombre}
        </option>
      ))}
    </select>
  )
}
