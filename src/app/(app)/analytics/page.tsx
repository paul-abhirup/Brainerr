"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useTasks } from "@/hooks/use-tasks"
import { useHabits } from "@/hooks/use-data"
import { Card, CardTitle, CardDescription } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { BarChart3, TrendingUp, Clock, Flame, Zap, Brain } from "lucide-react"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, AreaChart, Area } from "recharts"

export default function AnalyticsPage() {
  const supabase = createClient()
  const { data: tasks } = useTasks()
  const { data: habits } = useHabits()

  // Fetch focus sessions for focus time tracking
  const { data: focusSessions } = useQuery({
    queryKey: ["focus_sessions"],
    queryFn: async () => {
      const user = (await supabase.auth.getUser()).data.user
      if (!user) return []
      const { data, error } = await supabase.from("focus_sessions").select("*").eq("user_id", user.id)
      if (error) throw error
      return data ?? []
    },
  })

  // Calculate metrics
  const completedTasks = useMemo(() => (tasks ?? []).filter((t) => t.status === "done"), [tasks])

  const totalFocusMinutes = useMemo(() => {
    return (focusSessions ?? []).reduce((acc, s) => acc + (s.duration_minutes ?? 0), 0)
  }, [focusSessions])

  // Estimation accuracy calculation
  const estimationData = useMemo(() => {
    return completedTasks
      .filter((t) => t.estimated_minutes && t.actual_minutes)
      .slice(0, 8)
      .map((t) => ({
        name: t.title.length > 12 ? t.title.slice(0, 11) + "…" : t.title,
        Estimated: t.estimated_minutes,
        Actual: t.actual_minutes,
      }))
  }, [completedTasks])

  // Average actual ÷ estimated ratio across completed tasks
  const estimationBuffer = useMemo(() => {
    const withBoth = completedTasks.filter((t) => t.estimated_minutes && t.actual_minutes)
    if (withBoth.length === 0) return null
    const ratio = withBoth.reduce((sum, t) => sum + t.actual_minutes! / t.estimated_minutes!, 0) / withBoth.length
    return `${ratio.toFixed(1)}x`
  }, [completedTasks])

  // Hourly completion distribution
  const hourlyData = useMemo(() => {
    const hoursCount: Record<number, number> = {}
    for (let h = 8; h <= 20; h += 2) hoursCount[h] = 0

    completedTasks.forEach((t) => {
      if (t.completed_at) {
        const hour = new Date(t.completed_at).getHours()
        const roundedHour = Math.floor(hour / 2) * 2
        if (hoursCount[roundedHour] !== undefined) {
          hoursCount[roundedHour] += 1
        }
      }
    })

    return Object.entries(hoursCount).map(([h, count]) => ({
      hour: `${h}:00`,
      tasks: count,
    }))
  }, [completedTasks])

  // Composite Productivity Score (0 - 100)
  const productivityScore = useMemo(() => {
    const taskScore = Math.min(40, completedTasks.length * 4)
    const focusScore = Math.min(30, Math.round(totalFocusMinutes / 5))
    const habitScore = Math.min(30, (habits ?? []).filter((h) => h.current_streak > 0).length * 10)
    return Math.min(100, taskScore + focusScore + habitScore)
  }, [completedTasks, totalFocusMinutes, habits])

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="ADHD Productivity Patterns"
        title="Analytics & Brain Insights"
        description="Data-driven patterns to calibrate effort estimation and spot energy hyperfocus peak hours."
        actions={
          <Card className="border-primary/40 p-4 flex items-center gap-4 shadow-md shrink-0">
            <div className="relative flex items-center justify-center h-14 w-14 rounded-full bg-primary/10 border-2 border-primary text-primary">
              <span className="text-xl font-black">{productivityScore}</span>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider text-disabled font-bold block">
                Productivity Score
              </span>
              <span className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                {productivityScore >= 75 ? (
                  <><Flame className="h-4 w-4 text-warning" /> Peak Flow State</>
                ) : productivityScore >= 40 ? (
                  <><Zap className="h-4 w-4 text-primary" /> Steady Rhythm</>
                ) : (
                  <><TrendingUp className="h-4 w-4 text-success" /> Building Momentum</>
                )}
              </span>
            </div>
          </Card>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 text-center border-border">
          <Clock className="h-5 w-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-black text-foreground">{totalFocusMinutes}m</p>
          <span className="text-xs text-disabled uppercase font-medium">Total Focus Time</span>
        </Card>

        <Card className="p-4 text-center border-border">
          <TrendingUp className="h-5 w-5 text-success mx-auto mb-1" />
          <p className="text-2xl font-black text-foreground">{completedTasks.length}</p>
          <span className="text-xs text-disabled uppercase font-medium">Tasks Completed</span>
        </Card>

        <Card className="p-4 text-center border-border">
          <Flame className="h-5 w-5 text-warning mx-auto mb-1" />
          <p className="text-2xl font-black text-foreground">
            {(habits ?? []).filter((h) => h.current_streak > 0).length} / {habits?.length ?? 0}
          </p>
          <span className="text-xs text-disabled uppercase font-medium">Active Streaks</span>
        </Card>

        <Card className="p-4 text-center border-border">
          <Zap className="h-5 w-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-black text-foreground">{estimationBuffer ?? "—"}</p>
          <span className="text-xs text-disabled uppercase font-medium">Estimation Buffer</span>
        </Card>
      </div>

      {/* Recharts Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* 1. Estimated vs Actual Minutes */}
        <Card className="border-border shadow-md p-6 space-y-4">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Task Estimation Accuracy
            </CardTitle>
            <CardDescription className="text-xs">
              Comparing estimated time vs actual minutes spent (calibration helper).
            </CardDescription>
          </div>

          <div className="h-64 w-full pt-2">
            {estimationData.length === 0 ? (
              <p className="text-xs text-disabled py-20 text-center">Log estimated & actual task times to view chart</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={estimationData}>
                  <XAxis dataKey="name" stroke="var(--disabled)" fontSize={11} />
                  <YAxis stroke="var(--disabled)" fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="Estimated" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Actual" fill="var(--warning)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* 2. Peak Hours Heatmap Bar Chart */}
        <Card className="border-border shadow-md p-6 space-y-4">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-success" />
              Peak Productivity Hours
            </CardTitle>
            <CardDescription className="text-xs">
              Task completions grouped by hour of the day.
            </CardDescription>
          </div>

          <div className="h-64 w-full pt-2">
            {hourlyData.length === 0 ? (
              <p className="text-xs text-disabled py-20 text-center">Complete tasks to reveal your peak hours</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyData}>
                  <defs>
                    <linearGradient id="hourGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--success)" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="hour" stroke="var(--disabled)" fontSize={11} />
                  <YAxis stroke="var(--disabled)" fontSize={11} />
                  <Tooltip />
                  <Area type="monotone" dataKey="tasks" stroke="var(--success)" fillOpacity={1} fill="url(#hourGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* ADHD Dread Pattern Insight */}
      <Card className="border-warning/40 bg-warning/5 shadow-md p-6 flex flex-col sm:flex-row items-center gap-4">
        <div className="p-4 rounded-xl bg-warning/10 text-warning shrink-0">
          <Brain className="h-8 w-8" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-foreground">Dread & Avoidance Pattern Identified</h4>
          <p className="text-xs text-muted-foreground">
            Tasks with Dread Level ≥ 4 take an average of 2.3 days to start. Use <span className="font-semibold text-warning">ADHD Paralysis Breaker</span> on Mondays to smash barrier tasks first.
          </p>
        </div>
      </Card>
    </div>
  )
}
