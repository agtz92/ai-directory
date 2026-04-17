import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from './components/ThemeProvider'
import Navbar from './components/Navbar'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Directorio Industrial MX — Encuentra Proveedores Industriales en México',
  description:
    'El directorio industrial más completo de México. Encuentra proveedores de manufactura, construcción, química, alimentos y más. Solicita cotizaciones en minutos.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <ThemeProvider>
          <Navbar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
