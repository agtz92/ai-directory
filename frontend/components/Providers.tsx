'use client'

import { useEffect } from 'react'

/**
 * Applies the saved theme class to <html> on mount (avoids flash).
 * Works with our custom useTheme hook — no external dependency needed.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const saved = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = saved === 'dark' || (!saved && prefersDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  return <>{children}</>
}
