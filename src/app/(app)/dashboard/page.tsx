"use client"

import { useMemo, useState } from "react"
import { format, subDays, subWeeks, startOfWeek, addDays } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useQuery } from "@tanstack/react-query"
import { useTasks, type TaskRow } from "@/hooks/use-tasks"
import { useHabits, useHabitLogs, useUserState } from "@/hooks/use-data"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import { Flame, Trophy, Moon, Battery, BatteryMedium, BatteryLow, AlertTriangle, ChevronRight } from "lucide-react"
import dynamic from "next/dynamic"
import { cn } from "@/lib/utils"

const BarChart = dynamic(() => import("@/components/dashboard/weekly-chart"), { ssr: false })
const Heatmap = dynamic(() => import("@/components/dashboard/heatmap"), { ssr: false })

type Mood = "low" | "medium" | "high"

export default function DashboardPage() {
  const { data: tasks } = useTasks()
  const { data: habits } = useHabits()
  const { data: userState } = useUserState()
  const supabase = createClient()

  const [mood, setMood] = useState<Mood | null>(userState?.mood_energy ?? null)

  const today = useMemo(() => new Date(), [])

  const { data: weekLogs } = useHabitLogs(
    format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    format(addDays(startOfWeek(today, { weekStartsOn: 1 }), 7), "yyyy-MM-dd"),
  )

  const points = useQuery({
    queryKey: ["points"],
    queryFn: async () => {
      const { data, error } = await supabase.from("achievements").select("points")
      if (error) throw error
      return (data ?? []).reduce((sum, a) => sum + a.points, 0)
    },
  })

  const missed = useMemo(() => {
    if (!tasks) return []
    return tasks
      .filter((t) => t.due_date && t.status !== "done" && new Date(t.due_date) < today)
      .sort((a, b) => (b.reschedule_count ?? 0) - (a.reschedule_count ?? 0))
      .slice(0, 6)
  }, [tasks, today])

  const doneToday = tasks?.filter((t) => t.status === "done" && t.completed_at && new Date(t.completed_at) >= startOfWeek(today, { weekStartsOn: 1 })).length ?? 0

  const habitsDoneToday = useMemo(() => {
    const todayStr = format(today, "yyyy-MM-dd")
    return (habits ?? []).filter((h) => weekLogs?.some((l) => l.habit_id === h.id && l.date === todayStr && l.completed)).length
  }, [habits, weekLogs, today])

  async function setMoodEnergy(value: Mood) {
    setMood(value)
    const user = (await supabase.auth.getUser()).data.user
    if (!user) return
    const { error } = await supabase
      .from("user_state")
      .upsert({ user_id: user.id, mood_energy: value, last_mood_checkin: new Date().toISOString() })
      .eq("user_id", user.id)
    if (error) toast.error(error.message)
    else toast.success("Check-in saved — Now view will adjust")
  }

  const level = Math.floor((points.data ?? 0) / 100) + 1

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Progress, gently surfaced.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-1 px-3 py-1.5 text-sm">
            <Trophy className="h-4 w-4 text-accent-warm" />
            <span className="tabular-nums">{points.data ?? 0} pts</span>
            <span className="text-text-disabled">· Lv {level}</span>
          </div>
          <MoodCheckIn mood={mood} onChange={setMoodEnergy} />
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Done this week" value={String(doneToday)} icon={<Flame className="h-4 w-4 text-accent-success" />} />
        <StatCard label="Habits done today" value={`${habitsDoneToday}/${habits?.length ?? 0}`} icon={<Flame className="h-4 w-4 text-accent-warm" />} />
        <StatCard label="Open tasks" value={String(tasks?.filter((t) => t.status !== "done").length ?? 0)} icon={<ChevronRight className="h-4 w-4 text-accent-primary" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Weekly pace</CardTitle>
            <CardDescription className="text-xs">Tasks completed vs. open, last 8 weeks</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart tasks={tasks ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Missed, gently surfaced</CardTitle>
            <CardDescription className="text-xs">
              Overdue tasks, sorted by how often you&apos;ve pushed them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {missed.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-secondary">Nothing overdue. Enjoy it.</p>
            ) : (
              <ul className="space-y-2">
                {missed.map((t) => (
                  <MissedRow key={t.id} task={t} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Activity heatmap</CardTitle>
          <CardDescription className="text-xs">Habit check-offs over the last ~6 months</CardDescription>
        </CardHeader>
        <CardContent>
          <Heatmap logs={weekLogs ?? []} habits={habits ?? []} />
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-1 p-4">
      <div className="flex items-center gap-2 text-xs text-text-secondary">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function MissedRow({ task }: { task: TaskRow }) {
  const repeated = (task.reschedule_count ?? 0) >= 3
  const dread = (task.dread_level ?? 0) >= 3
  return (
    <li className="rounded-lg border border-border-subtle bg-surface-1/60 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-sm">{task.title}</span>
        {task.due_date && (
          <span className="shrink-0 text-xs tabular-nums text-accent-warm">
            due {format(new Date(task.due_date), "MMM d")}
          </span>
        )}
      </div>
      {(repeated || dread) && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-accent-warm">
          <AlertTriangle className="h-3 w-3" />
          {repeated
            ? `Rescheduled ${task.reschedule_count}× — maybe break this down?`
            : "High-dread task — want to split it into 2 smaller steps?"}
        </p>
      )}
    </li>
  )
}

function MoodCheckIn({ mood, onChange }: { mood: Mood | null; onChange: (m: Mood) => void }) {
  const options: { value: Mood; label: string; icon: React.ReactNode }[] = [
    { value: "low", label: "Low", icon: <BatteryLow className="h-4 w-4" /> },
    { value: "medium", label: "Medium", icon: <BatteryMedium className="h-4 w-4" /> },
    { value: "high", label: "High", icon: <Battery className="h-4 w-4" /> },
  ]
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-1 p-1">
      <span className="flex items-center gap-1 pl-2 pr-1 text-xs text-text-secondary">
        <Moon className="h-3.5 w-3.5" />
        Energy
      </span>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          title={`${o.label} energy`}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
            mood === o.value ? "bg-accent-primary/20 text-accent-primary" : "text-text-secondary hover:text-text-primary",
          )}
        >
          {o.icon}
        </button>
      ))}
    </div>
  )
}
