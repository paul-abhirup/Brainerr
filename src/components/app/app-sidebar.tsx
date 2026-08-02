"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  Brain,
  Inbox,
  CalendarDays,
  Target,
  Repeat,
  StickyNote,
  Timer,
  LayoutDashboard,
  Zap,
  Settings,
  Search,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const nav = [
  { href: "/now", label: "Now", icon: Zap },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/planner", label: "Planner", icon: CalendarDays },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/habits", label: "Habits", icon: Repeat },
  { href: "/notes", label: "Notes", icon: StickyNote },
  { href: "/focus", label: "Focus", icon: Timer },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
]

export function AppSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border-subtle bg-surface-1 md:flex">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-2">
          <Brain className="h-4 w-4 text-accent-primary" />
        </div>
        <span className="text-base font-semibold tracking-tight">Brainer</span>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || (href !== "/now" && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-surface-3 text-text-primary"
                  : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="space-y-0.5 border-t border-border-subtle px-3 py-3">
        <Link
          href="/review"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname.startsWith("/review")
              ? "bg-surface-3 text-text-primary"
              : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
          )}
        >
          <Search className="h-4 w-4" />
          Weekly review
        </Link>
        <Link
          href="/settings/calendar"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname.startsWith("/settings")
              ? "bg-surface-3 text-text-primary"
              : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
        <div className="flex items-center justify-between px-3 pt-3">
          <span className="truncate text-xs text-text-disabled">{userEmail}</span>
          <Button variant="ghost" size="sm" onClick={signOut} className="h-7 text-xs">
            Sign out
          </Button>
        </div>
      </div>
    </aside>
  )
}
