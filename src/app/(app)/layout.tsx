import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { QueryProvider } from "@/components/providers/query-provider"
import { AppSidebar } from "@/components/app/app-sidebar"
import { QuickAddProvider } from "@/components/app/quick-add-provider"
import { CommandPalette } from "@/components/app/command-palette"
import { ReminderProvider } from "@/components/app/reminder-provider"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  return (
    <QueryProvider>
      <QuickAddProvider>
        <ReminderProvider />
        <div className="flex min-h-dvh">
          <AppSidebar userEmail={user.email ?? "user"} />
          <main className="ml-0 flex-1 md:ml-64">
            <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
              {children}
            </div>
          </main>
        </div>
        <CommandPalette />
      </QuickAddProvider>
    </QueryProvider>
  )
}
