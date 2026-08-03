"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/types/database"

let supabaseClient: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  // Return a client even if env vars are missing - the Supabase library will handle it
  if (supabaseClient) {
    return supabaseClient
  }

  supabaseClient = createBrowserClient<Database>(
    url || "",
    key || "",
  )
  
  return supabaseClient
}
