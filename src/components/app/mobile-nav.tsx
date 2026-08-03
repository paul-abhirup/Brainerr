"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useQuickAdd } from "@/components/app/quick-add-provider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { NotificationCenter } from "@/components/app/notification-center"
import {
  Zap,
  Inbox,
  Timer,
  Repeat,
  LayoutDashboard,
  Menu,
  Plus,
  CalendarDays,
  Target,
  StickyNote,
  Search,
  Settings,
  LogOut,
  X,
  Brain,
  Network,
  Sparkles,
  BookOpen,
} from "lucide-react"

const primaryNav = [
  { href: "/now", label: "Now", icon: Zap },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/focus", label: "Focus", icon: Timer },
  { href: "/habits", label: "Habits", icon: Repeat },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
]

const secondaryNav = [
  { href: "/capture", label: "Rapid Dump", icon: Sparkles },
  { href: "/journal", label: "Daily Journal", icon: BookOpen },
  { href: "/visualizer", label: "Task Visualizers", icon: Network },
  { href: "/planner", label: "Planner", icon: CalendarDays },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/notes", label: "Notes", icon: StickyNote },
  { href: "/review", label: "Weekly Review", icon: Search },
  { href: "/settings/calendar", label: "Settings", icon: Settings },
]


export function MobileNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { openQuickAdd } = useQuickAdd()
  const [drawerOpen, setDrawerOpen] = useState(false)

  async function signOut() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <>
      {/* Quick Add Mobile Floating Action Button (FAB) */}
      <div className="fixed bottom-20 right-4 z-40 md:hidden">
        <button
          onClick={openQuickAdd}
          aria-label="Quick add task or note"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-primary text-surface-base shadow-lg shadow-accent-primary/25 transition-transform active:scale-95"
        >
          <Plus className="h-6 w-6 stroke-[2.5]" />
        </button>
      </div>

      {/* Bottom Floating Navigation Bar */}
      <nav className="fixed inset-x-3 bottom-3 z-40 flex h-16 items-center justify-around rounded-2xl border border-white/10 bg-surface-1/90 px-2 backdrop-blur-xl shadow-2xl md:hidden">
        {primaryNav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/now" && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-1.5 transition-all",
                active ? "text-accent-primary font-medium" : "text-text-secondary hover:text-text-primary",
              )}
            >
              {active && (
                <span className="absolute -top-1 h-1 w-5 rounded-full bg-accent-primary shadow-[0_0_8px_var(--accent-primary)]" />
              )}
              <Icon className={cn("h-5 w-5 transition-transform", active && "scale-110")} />
              <span className="text-xs tracking-tight">{label}</span>
            </Link>
          )
        })}

        {/* More button */}
        <button
          onClick={() => setDrawerOpen(true)}
          className={cn(
            "flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-1.5 transition-colors text-text-secondary hover:text-text-primary",
          )}
        >
          <Menu className="h-5 w-5" />
          <span className="text-xs tracking-tight">More</span>
        </button>
      </nav>

      {/* Slide-out Mobile Menu Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          />

          {/* Drawer content */}
          <div className="absolute inset-y-0 right-0 w-4/5 max-w-sm border-l border-border-subtle bg-surface-1 p-6 shadow-2xl flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-2">
                    <Brain className="h-4 w-4 text-accent-primary" />
                  </div>
                  <span className="text-base font-semibold tracking-tight">Brainer</span>
                </div>
                <div className="flex items-center gap-2">
                  <NotificationCenter />
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-2 hover:text-text-primary cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <p className="px-3 text-xs font-semibold uppercase tracking-wider text-text-disabled mb-2">
                  All Views
                </p>
                {secondaryNav.map(({ href, label, icon: Icon }) => {
                  const active = pathname.startsWith(href)
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setDrawerOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
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
              </div>
            </div>

            <div className="border-t border-border-subtle pt-4 space-y-3">
              <div className="px-3">
                <p className="truncate text-xs text-text-disabled">{userEmail}</p>
              </div>
              <Button variant="outline" size="sm" onClick={signOut} className="w-full justify-start gap-2">
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
