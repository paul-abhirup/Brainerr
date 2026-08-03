"use client"

import { useEffect, useState } from "react"

export function SupabaseErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.message.includes("Supabase") || event.message.includes("URL and API key")) {
        setHasError(true)
        setError(event.error)
      }
    }

    window.addEventListener("error", handleError)
    return () => window.removeEventListener("error", handleError)
  }, [])

  if (hasError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-base px-4">
        <div className="w-full max-w-md">
          <div className="rounded-lg border border-border-subtle bg-surface-1 p-6">
            <h1 className="text-xl font-semibold text-text-primary mb-2">Configuration Required</h1>
            <p className="text-text-secondary mb-4">
              This app requires Supabase to be configured. Please set up your Supabase project and environment variables.
            </p>
            <p className="text-sm text-text-disabled bg-surface-2 rounded p-3 mb-4">
              Missing environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
            </p>
            <a
              href="https://supabase.com/dashboard"
              className="inline-block px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90 transition-colors"
            >
              Go to Supabase Dashboard
            </a>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
