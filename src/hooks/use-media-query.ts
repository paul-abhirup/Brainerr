"use client"

import { useCallback, useSyncExternalStore } from "react"

/**
 * SSR-safe media query hook built on useSyncExternalStore.
 * Returns false on the server, live value on the client.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener("change", onStoreChange)
      return () => mql.removeEventListener("change", onStoreChange)
    },
    [query],
  )
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query])
  const getServerSnapshot = useCallback(() => false, [])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** True below the `md` breakpoint (< 768px) — the app's mobile/tablet split. */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)")
}
