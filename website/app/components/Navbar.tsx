'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, Grid3X3, Sun, Moon, Building2, Factory, Newspaper } from 'lucide-react'
import { useTheme } from './ThemeProvider'

export default function Navbar() {
  const pathname = usePathname()
  const { theme, toggle } = useTheme()

  const links = [
    { href: '/categorias', label: 'Categorías', icon: Grid3X3 },
    { href: '/proveedores', label: 'Proveedores', icon: Factory },
    { href: '/blog', label: 'Blog', icon: Newspaper },
    { href: '/buscar', label: 'Buscar', icon: Search },
  ]

  return (
    <nav className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
            <Building2 size={14} className="text-white" />
          </div>
          <span className="font-bold text-slate-900 dark:text-slate-100 text-sm hidden sm:block">
            Directorio Industrial <span className="text-blue-600">MX</span>
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon size={15} />
                <span className="hidden sm:block">{label}</span>
              </Link>
            )
          })}

          {/* Dark mode toggle */}
          <button
            onClick={toggle}
            aria-label="Toggle dark mode"
            className="ml-1 p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-all"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>
    </nav>
  )
}
