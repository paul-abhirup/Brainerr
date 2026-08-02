import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

// Server-only. Never import this from client components or use the service role key client-side.
let adminClient: ReturnType<typeof createClient<Database>> | null = null

export function getAdminClient() {
  if (!adminClient) {
    adminClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    )
  }
  return adminClient
}
