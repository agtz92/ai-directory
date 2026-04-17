import { redirect } from 'next/navigation'

export default function EmpresaCategoriasPage() {
  redirect('/empresa?tab=categorias')
}
