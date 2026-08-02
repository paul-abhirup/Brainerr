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
  FolderKanban,
  Network,
  Sparkles,
  BookOpen,
  Trophy,
  BarChart3,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { NotificationCenter } from "@/components/app/notification-center"

const nav = [
  { href: "/now", label: "Now", icon: Zap },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/capture", label: "Rapid Dump", icon: Sparkles },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/achievements", label: "Achievements", icon: Trophy },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/visualizer", label: "Visualizers", icon: Network },
  { href: "/planner", label: "Planner", icon: CalendarDays },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/projects", label: "Projects", icon: FolderKanban },
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
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border-subtle bg-surface-1/95 backdrop-blur-md md:flex">
      <div className="flex h-16 items-center justify-between px-5 border-b border-border-subtle/50">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-primary/20 to-accent-primary/5 border border-accent-primary/30 shadow-[0_0_12px_rgba(124,158,255,0.2)]">
            <Brain className="h-5 w-5 text-accent-primary animate-pulse" />
          </div>
          <div>
            <span className="text-base font-semibold tracking-tight block">Brainer</span>
            <span className="text-xs text-text-disabled tracking-wider uppercase font-medium">2nd Brain ADHD</span>
          </div>
        </div>
        <NotificationCenter />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || (href !== "/now" && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-accent-primary/10 text-accent-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] font-semibold"
                  : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
              )}
            >
              {active && (
                <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-accent-primary shadow-[0_0_8px_var(--accent-primary)]" />
              )}
              <Icon className={cn("h-4.5 w-4.5 transition-transform duration-200 group-hover:scale-110", active && "text-accent-primary")} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="space-y-1 border-t border-border-subtle/60 px-3 py-3">
        <Link
          href="/review"
          className={cn(
            "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
            pathname.startsWith("/review")
              ? "bg-accent-primary/10 text-accent-primary font-semibold"
              : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
          )}
        >
          <Search className="h-4.5 w-4.5 transition-transform duration-200 group-hover:scale-110" />
          Weekly review
        </Link>
        <Link
          href="/settings"
          className={cn(
            "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
            pathname.startsWith("/settings")
              ? "bg-accent-primary/10 text-accent-primary font-semibold"
              : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
          )}
        >
          <Settings className="h-4.5 w-4.5 transition-transform duration-200 group-hover:scale-110" />
          Settings
        </Link>
        <div className="flex items-center justify-between px-3 pt-3">
          <span className="truncate text-xs text-text-disabled">{userEmail}</span>
          <Button variant="ghost" size="sm" onClick={signOut} className="h-7 text-xs hover:bg-surface-2">
            Sign out
          </Button>
        </div>
      </div>
    </aside>
  )
}
