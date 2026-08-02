"use client"

import { useMemo, useState } from "react"
import { format, startOfWeek, addDays } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useQuery } from "@tanstack/react-query"
import { useTasks, type TaskRow } from "@/hooks/use-tasks"
import { useHabits, useHabitLogs, useUserState } from "@/hooks/use-data"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { toast } from "sonner"
import { Flame, Trophy, Moon, Battery, BatteryMedium, BatteryLow, AlertTriangle, Sparkles, CheckCircle2, ListTodo } from "lucide-react"
import { cn } from "@/lib/utils"
import { WellnessWidget } from "@/components/app/wellness-widget"
import dynamic from "next/dynamic"

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

  // Time of day greeting
  const greeting = useMemo(() => {
    const hour = today.getHours()
    if (hour < 12) return "Good morning"
    if (hour < 18) return "Good afternoon"
    return "Good evening"
  }, [today])

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
    else toast.success("Energy saved — Now view adapted")
  }

  const pts = points.data ?? 0
  const level = Math.floor(pts / 100) + 1
  const levelProgress = pts % 100

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner Header */}
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {greeting}
            <Sparkles className="h-5 w-5 text-accent-warm animate-pulse" />
          </span>
        }
        description="Here is your executive overview. Low pressure, momentum built step-by-step."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-accent-warm/30 bg-surface-1/80 px-3.5 py-2 text-sm backdrop-blur-md shadow-sm">
              <Trophy className="h-4 w-4 text-accent-warm" />
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <span className="tabular-nums">{pts} pts</span>
                  <span className="text-text-disabled">·</span>
                  <span className="text-accent-warm">Lv {level}</span>
                </div>
                <div className="mt-1 h-1 w-20 rounded-full bg-surface-3 overflow-hidden">
                  <div className="h-full bg-accent-warm rounded-full transition-all duration-500" style={{ width: `${levelProgress}%` }} />
                </div>
              </div>
            </div>

            <MoodCheckIn mood={mood} onChange={setMoodEnergy} />
          </div>
        }
      />

      {/* Summary KPI Glass Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <GlassStatCard
          label="Done this week"
          value={doneToday}
          subtitle="Completed tasks"
          icon={<CheckCircle2 className="h-4 w-4 text-accent-success" />}
          accentColor="var(--accent-success)"
        />
        <GlassStatCard
          label="Habits completed today"
          value={`${habitsDoneToday}/${habits?.length ?? 0}`}
          subtitle={`${Math.round(((habitsDoneToday ?? 0) / Math.max(1, habits?.length ?? 1)) * 100)}% daily rate`}
          icon={<Flame className="h-4 w-4 text-accent-warm" />}
          accentColor="var(--accent-warm)"
        />
        <GlassStatCard
          label="Open tasks"
          value={tasks?.filter((t) => t.status !== "done").length ?? 0}
          subtitle="Ready in queue"
          icon={<ListTodo className="h-4 w-4 text-accent-primary" />}
          accentColor="var(--accent-primary)"
        />
      </div>

      {/* 💧 Body & Wellness Fuel Tracker */}
      <WellnessWidget />

      {/* Weekly Pace & Surfaced Tasks */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="glass-card border-border-subtle/60 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Weekly pace</span>
              <span className="text-xs font-normal text-text-disabled">Last 8 weeks</span>
            </CardTitle>
            <CardDescription>
              Completed vs. open tasks comparison
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart tasks={tasks ?? []} />
          </CardContent>
        </Card>

        <Card className="glass-card border-border-subtle/60 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-accent-warm" />
              <span>Gently Surfaced Tasks</span>
            </CardTitle>
            <CardDescription>
              Overdue items sorted by how often you&apos;ve rescheduled them. No shame, just clarity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {missed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CheckCircle2 className="h-8 w-8 text-accent-success/60 mb-2" />
                <p className="text-sm font-medium text-text-primary">All caught up!</p>
                <p className="text-xs text-text-secondary mt-0.5">Nothing overdue. Great rhythm.</p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {missed.map((t) => (
                  <MissedRow key={t.id} task={t} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Heatmap */}
      <Card className="glass-card border-border-subtle/60 shadow-lg">
        <CardHeader>
          <CardTitle>Consistency Heatmap</CardTitle>
          <CardDescription>Habit check-offs over the last ~6 months</CardDescription>
        </CardHeader>
        <CardContent>
          <Heatmap logs={weekLogs ?? []} habits={habits ?? []} />
        </CardContent>
      </Card>
    </div>
  )
}

function GlassStatCard({
  label,
  value,
  subtitle,
  icon,
  accentColor,
}: {
  label: string
  value: string | number
  subtitle: string
  icon: React.ReactNode
  accentColor: string
}) {
  return (
    <div className="glass-card glass-card-hover rounded-xl p-5 relative overflow-hidden group">
      <div
        className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl pointer-events-none opacity-20 transition-opacity group-hover:opacity-40"
        style={{ background: accentColor }}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-secondary">{label}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-2/80 border border-white/5">
          {icon}
        </div>
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight tabular-nums">{value}</div>
      <p className="mt-1 text-xs text-text-disabled">{subtitle}</p>
    </div>
  )
}

function MissedRow({ task }: { task: TaskRow }) {
  const repeated = (task.reschedule_count ?? 0) >= 3
  const dread = (task.dread_level ?? 0) >= 3
  return (
    <li className="rounded-xl border border-border-subtle/70 bg-surface-1/80 p-3 backdrop-blur-sm transition-all hover:border-accent-warm/40">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-sm font-medium text-text-primary">{task.title}</span>
        {task.due_date && (
          <span className="shrink-0 rounded-full bg-accent-warm/15 px-2 py-0.5 text-xs font-medium tabular-nums text-accent-warm">
            due {format(new Date(task.due_date), "MMM d")}
          </span>
        )}
      </div>
      {(repeated || dread) && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-accent-warm font-medium">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {repeated
            ? `Pushed ${task.reschedule_count}× — consider splitting into smaller steps`
            : "High-dread task — try a quick 5-min focus block"}
        </p>
      )}
    </li>
  )
}

function MoodCheckIn({ mood, onChange }: { mood: Mood | null; onChange: (m: Mood) => void }) {
  const options: { value: Mood; label: string; icon: React.ReactNode }[] = [
    { value: "low", label: "Low", icon: <BatteryLow className="h-4 w-4 text-accent-danger" /> },
    { value: "medium", label: "Med", icon: <BatteryMedium className="h-4 w-4 text-accent-warm" /> },
    { value: "high", label: "High", icon: <Battery className="h-4 w-4 text-accent-success" /> },
  ]
  return (
    <div className="flex items-center gap-1 rounded-xl border border-border-subtle/70 bg-surface-1/80 p-1 backdrop-blur-md">
      <span className="flex items-center gap-1 pl-3 pr-1 text-xs text-text-secondary font-medium">
        <Moon className="h-3.5 w-3.5 text-accent-primary" />
        Energy
      </span>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          title={`${o.label} energy`}
          className={cn(
            "flex h-8 items-center gap-1 px-2.5 rounded-xl text-xs font-medium transition-all active:scale-95",
            mood === o.value
              ? "bg-surface-3 text-text-primary shadow-sm border border-white/10"
              : "text-text-secondary hover:text-text-primary hover:bg-surface-2/60",
          )}
        >
          {o.icon}
          <span className="hidden sm:inline">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

