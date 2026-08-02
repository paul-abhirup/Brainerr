"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

type QuickAddContextValue = {
  isOpen: boolean
  openQuickAdd: () => void
  closeQuickAdd: () => void
}

const QuickAddContext = createContext<QuickAddContextValue | null>(null)

export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const openQuickAdd = useCallback(() => setIsOpen(true), [])
  const closeQuickAdd = useCallback(() => setIsOpen(false), [])

  const value = useMemo(
    () => ({ isOpen, openQuickAdd, closeQuickAdd }),
    [isOpen, openQuickAdd, closeQuickAdd],
  )

  return (
    <QuickAddContext.Provider value={value}>
      {children}
    </QuickAddContext.Provider>
  )
}

export function useQuickAdd() {
  const ctx = useContext(QuickAddContext)
  if (!ctx) throw new Error("useQuickAdd must be used within QuickAddProvider")
  return ctx
}
