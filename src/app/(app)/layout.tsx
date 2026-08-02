import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { QueryProvider } from "@/components/providers/query-provider"
import { AppSidebar } from "@/components/app/app-sidebar"
import { MobileNav } from "@/components/app/mobile-nav"
import { QuickAddProvider } from "@/components/app/quick-add-provider"
import { CommandPalette } from "@/components/app/command-palette"
import { ReminderProvider } from "@/components/app/reminder-provider"
import { DistractionJar } from "@/components/app/distraction-jar"

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

  const email = user.email ?? "user"

  return (
    <QueryProvider>
      <QuickAddProvider>
        <ReminderProvider />
        <div className="flex min-h-dvh">
          <AppSidebar userEmail={email} />
          <MobileNav userEmail={email} />
          <main className="ml-0 flex-1 md:ml-64">
            <div className="mx-auto w-full max-w-5xl px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-8">
              {children}
            </div>
          </main>
        </div>
        <CommandPalette />
        <DistractionJar />
      </QuickAddProvider>
    </QueryProvider>
  )
}


