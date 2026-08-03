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
  BarChart3,
  Trophy,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { NotificationCenter } from "@/components/app/notification-center"

const navGroups = [
  {
    label: "Today",
    items: [
      { href: "/now", label: "Now", icon: Zap },
      { href: "/inbox", label: "Inbox", icon: Inbox },
      { href: "/focus", label: "Focus", icon: Timer },
    ],
  },
  {
    label: "Plan",
    items: [
      { href: "/capture", label: "Rapid Dump", icon: Sparkles },
      { href: "/planner", label: "Planner", icon: CalendarDays },
      { href: "/review", label: "Weekly Review", icon: Search },
    ],
  },
  {
    label: "Track",
    items: [
      { href: "/habits", label: "Habits", icon: Repeat },
      { href: "/goals", label: "Goals", icon: Target },
      { href: "/projects", label: "Projects", icon: FolderKanban },
      { href: "/journal", label: "Journal", icon: BookOpen },
      { href: "/notes", label: "Notes", icon: StickyNote },
      { href: "/visualizer", label: "Visualizers", icon: Network },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/achievements", label: "Achievements", icon: Trophy },
    ],
  },
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
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-16 items-center justify-between px-5 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 shadow-[0_0_12px_color-mix(in_srgb,var(--primary)_20%,transparent)]">
            <Brain className="h-5 w-5 text-primary animate-pulse" />
          </div>
          <div>
            <span className="text-base font-semibold tracking-tight block">Brainer</span>
            <span className="text-xs text-disabled tracking-wider uppercase font-medium">2nd Brain ADHD</span>
          </div>
        </div>
        <NotificationCenter />
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-disabled">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active =
                  pathname === href || (href !== "/now" && pathname.startsWith(href))
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
                      active
                        ? "bg-primary/10 text-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] font-semibold"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary shadow-[0_0_8px_var(--primary)]" />
                    )}
                    <Icon className={cn("h-4.5 w-4.5 transition-transform duration-200 group-hover:scale-110", active && "text-primary")} />
                    <span>{label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-1 border-t border-border/60 px-3 py-3">
        <Link
          href="/settings"
          className={cn(
            "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
            pathname.startsWith("/settings")
              ? "bg-primary/10 text-primary font-semibold"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground",
          )}
        >
          <Settings className="h-4.5 w-4.5 transition-transform duration-200 group-hover:scale-110" />
          Settings
        </Link>
        <div className="flex items-center justify-between px-3 pt-3">
          <span className="truncate text-xs text-disabled">{userEmail}</span>
          <Button variant="ghost" size="sm" onClick={signOut} className="h-7 text-xs hover:bg-secondary">
            Sign out
          </Button>
        </div>
      </div>
    </aside>
  )
}
