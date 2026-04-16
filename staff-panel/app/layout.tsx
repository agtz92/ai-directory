import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ApolloWrapper } from '@/components/ApolloWrapper'
import { AuthProvider } from '@/components/AuthProvider'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Staff Panel — Directorio Industrial',
  description: 'Panel interno de soporte técnico',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.className} min-h-screen bg-gray-50 text-gray-900 antialiased`}>
        <ApolloWrapper>
          <AuthProvider>
            {children}
            <Toaster richColors position="top-right" />
          </AuthProvider>
        </ApolloWrapper>
      </body>
    </html>
  )
}
