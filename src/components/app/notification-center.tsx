"use client"

import { useMemo, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Bell, Flame, AlertTriangle, Clock } from "lucide-react"
import { useTasks } from "@/hooks/use-tasks"
import { useHabits } from "@/hooks/use-data"
import { isBefore } from "date-fns"
import { cn } from "@/lib/utils"

export function NotificationCenter() {
  const { data: tasks } = useTasks()
  const { data: habits } = useHabits()
  const [readIds, setReadIds] = useState<string[]>([])
  const [open, setOpen] = useState(false)

  // Generate dynamic notification feed from task & habit state
  const notifications = useMemo(() => {
    const list: Array<{
      id: string
      type: "overdue" | "streak" | "reminder" | "achievement"
      title: string
      body: string
      time: string
      actionUrl?: string
    }> = []

    const now = new Date()

    // 1. Overdue tasks alerts
    const overdueTasks = (tasks ?? []).filter(
      (t) => t.status !== "done" && t.due_date && isBefore(new Date(t.due_date), now),
    )

    if (overdueTasks.length > 0) {
      list.push({
        id: "overdue-alert",
        type: "overdue",
        title: `${overdueTasks.length} Overdue Task${overdueTasks.length > 1 ? "s" : ""}`,
        body: `You have ${overdueTasks.length} task${overdueTasks.length > 1 ? "s" : ""} past due. Try using Paralysis Breaker!`,
        time: "Just now",
        actionUrl: "/now",
      })
    }

    // 2. Habit streak warnings / milestones
    (habits ?? []).forEach((h) => {
      if (h.current_streak >= 3) {
        list.push({
          id: `streak-${h.id}`,
          type: "streak",
          title: `🔥 ${h.current_streak}-Day Streak!`,
          body: `Keep it up! Your streak for "${h.title}" is on fire.`,
          time: "Today",
          actionUrl: "/habits",
        })
      }
    })

    // 3. System reminder
    list.push({
      id: "weekly-review-reminder",
      type: "reminder",
      title: "📅 Weekly Review Ready",
      body: "Conduct your weekly review to clear stale backlog and set next week's Big 3.",
      time: "This week",
      actionUrl: "/review",
    })

    return list
  }, [tasks, habits])

  const unreadList = notifications.filter((n) => !readIds.includes(n.id))

  function markAllRead() {
    setReadIds(notifications.map((n) => n.id))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-secondary cursor-pointer text-muted-foreground transition-colors">
        <Bell className="h-4 w-4" />
        {unreadList.length > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-warning text-xs font-bold text-black animate-pulse">
            {unreadList.length}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0 shadow-2xl border-2 border-border bg-card rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/60">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Notifications
            </h4>
            {unreadList.length > 0 && (
              <Badge variant="secondary" className="bg-primary/20 text-primary text-xs">
                {unreadList.length} New
              </Badge>
            )}
          </div>

          {unreadList.length > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-primary hover:underline font-medium cursor-pointer"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Notification List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-border/50">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-xs text-disabled">
              No notifications right now.
            </div>
          ) : (
            notifications.map((n) => {
              const isRead = readIds.includes(n.id)
              return (
                <div
                  key={n.id}
                  className={cn(
                    "p-3.5 transition-colors space-y-1",
                    isRead ? "bg-card/40 opacity-70" : "bg-secondary/80 font-medium",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      {n.type === "overdue" && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
                      {n.type === "streak" && <Flame className="h-3.5 w-3.5 text-warning" />}
                      {n.type === "reminder" && <Clock className="h-3.5 w-3.5 text-primary" />}
                      {n.title}
                    </span>
                    <span className="text-xs text-disabled">{n.time}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug">{n.body}</p>
                </div>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
