"use client"

import { useState, useEffect } from "react"
import { WifiOff } from "lucide-react"

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(() => {
    if (typeof window !== "undefined") return !navigator.onLine
    return false
  })

  useEffect(() => {
    function handleOnline() {
      setIsOffline(false)
    }
    function handleOffline() {
      setIsOffline(true)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div className="fixed top-5 sm:top-3 left-1/2 -translate-x-1/2 z-50 animate-bounce">
      <div className="flex items-center gap-2 rounded-full border border-warning/40 bg-card/90 px-4 py-1.5 text-xs font-semibold text-warning shadow-xl backdrop-blur-md">
        <WifiOff className="h-3.5 w-3.5" />
        <span>Offline Mode Active · Actions queued locally</span>
      </div>
    </div>
  )
}
