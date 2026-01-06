import { useState, useEffect } from 'react'
import { WifiOff } from 'lucide-react'

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div className="bg-[var(--warning-muted)] border-b border-[var(--warning)]/30 text-[var(--warning)] px-4 py-2 text-center text-sm">
      <span className="inline-flex items-center gap-2">
        <WifiOff className="w-4 h-4" />
        You're offline. Some features may be unavailable.
      </span>
    </div>
  )
}
